# Guia de estudo: cache com Redis no catálogo do Moonlight

Objetivo: entender o que foi feito a ponto de explicar, justificar e defender na apresentação.

---

## 1. O problema que o cache resolve

Cada `GET /api/games/7` hoje vira uma consulta no MySQL: a requisição chega,
o pool entrega uma conexão, o banco executa o SQL (com join de categorias),
lê do disco ou do buffer e devolve. Quando muita gente pede o **mesmo** dado,
o banco repete o mesmo trabalho várias vezes para devolver a mesma resposta.

Cache é guardar o resultado de um trabalho caro num lugar mais rápido,
para não refazer o trabalho enquanto a resposta ainda serve.
Analogia: em vez de ir ao arquivo toda vez que alguém pergunta o preço de um
produto, você anota o preço num post-it na mesa e só vai ao arquivo se o post-it
sumiu ou venceu.

Dois ganhos: **latência** (resposta mais rápida) e **carga** (o banco, que é
o componente mais difícil de escalar, recebe menos consultas).

## 2. O que é o Redis e por que ele é rápido

Redis é um banco de dados **em memória** do tipo **chave-valor**. Cada entrada
é uma chave (texto) apontando para um valor. Três razões da velocidade:

1. Os dados ficam na **RAM**, não no disco.
2. A estrutura é simples (procurar por chave exata), sem planejador de consulta nem join.
3. A execução dos comandos é **single-thread**, sem custo de lock entre threads.
   Isso tem um efeito colateral importante, que aparece na seção 7.

Por ser memória, o Redis não substitui o MySQL: o MySQL continua sendo a
**fonte da verdade**. O Redis guarda **cópias descartáveis**. Se ele apagar tudo,
nada se perde, só fica mais lento por um tempo.

## 3. O padrão cache-aside (o que implementamos)

Também chamado de *lazy loading*: a **aplicação** controla o cache, e o cache
só é preenchido quando alguém pede.

**Leitura**

```
GET /api/games/7
  -> GameService.findById(7)
       -> CacheService.get("game:id:7")
            HIT  -> devolve direto (MySQL nem é consultado)
            MISS -> GameRepository.findById(7)   (MySQL)
                    -> CacheService.set("game:id:7", jogo, 300s)
                    -> devolve
```

**Escrita**

```
PUT /api/games/7
  -> GameService.update(...)
       -> grava no MySQL (transação + commit)
       -> CacheService.del("game:id:7")
       -> CacheService.delByPrefix("game:list:")
```

A ordem importa: **primeiro o banco, depois o cache**. Se invalidássemos antes
do commit, uma leitura no meio poderia recarregar o dado antigo.

Quem faz o quê no nosso código:

| Peça | Papel |
|---|---|
| `GameRepository` | só MySQL, não sabe que cache existe |
| `GameService` | orquestra o cache-aside |
| `CacheService` | fala com o Redis (get/set/del/delByPrefix) |
| `redis.ts` | conexão e infraestrutura |
| `game.cache.ts` | regras de chave e TTL do domínio game |

`CacheService` é **injetado** pelo `container.ts` (a regra 4 da arquitetura),
por isso os testes usam um mock em vez de um Redis real.

## 4. Por que cache-aside e não outro padrão

- **Read-through**: o próprio cache busca no banco no MISS. Exige um cache que
  saiba falar com o MySQL. Mais acoplado.
- **Write-through**: toda escrita grava no banco **e** no cache juntos.
  Mantém o cache quente, mas gasta escrita com dados que talvez ninguém leia.
- **Write-behind**: grava no cache e o banco recebe depois, em lote.
  Rápido, mas arriscado: se o cache cair antes de sincronizar, perde dado.

Cache-aside ganha aqui porque é o mais simples de entender e de testar, porque
o cache é **opcional** (se cair, a aplicação continua funcionando) e porque
só guarda o que foi realmente pedido.

## 5. Chaves: o que cachear e como nomear

- `game:id:7` guarda um jogo. A chave é **previsível**: dá para montá-la só
  com o id.
- `game:list:{json}` guarda uma listagem. O JSON dos filtros sai sempre na
  mesma ordem, então a mesma busca gera a mesma chave. Se a ordem variasse,
  a mesma busca viraria duas entradas.
- O prefixo (`game:`, `game:list:`) organiza e permite apagar por grupo.

Dois conceitos para saber explicar:

- **Taxa de acerto (hit ratio)** = HITs / (HITs + MISSes). É a métrica que
  diz se o cache compensa. Cache só ajuda quando a mesma chave é pedida
  várias vezes antes de expirar.
- **Cardinalidade**: quantas chaves diferentes podem existir. O detalhe de um
  jogo tem cardinalidade baixa (um por jogo, e poucos concentram os acessos).
  Busca por texto livre tem cardinalidade enorme: quase cada busca é única,
  quase nunca dá HIT e só ocupa memória.

Por isso a regra do projeto: detalhe e listagens de baixa cardinalidade
entram; `findAll()` sem paginação e listagem aleatória (`random`) ficam de fora.
`admin` entra na chave porque o admin enxerga jogos inativos e o público não:
sem isso, a lista do admin poderia vazar para o público.

## 6. TTL: a rede de segurança

TTL (*Time To Live*) é o tempo de vida de uma chave. Passado o tempo, o Redis
apaga sozinho (na leitura, se vencida, e também em varreduras periódicas).
Na gravação usamos `SET chave valor EX 300`, que grava e define o prazo
numa única operação atômica.

Nossos valores: **300 s** no detalhe, **60 s** na listagem. A listagem tem prazo
menor porque qualquer jogo novo ou editado a torna velha.

O TTL é um trade-off entre **frescor** e **eficiência**:

- TTL curto: dado sempre fresco, mas pouco HIT.
- TTL longo: muito HIT, mas dado velho por mais tempo.

E é também a **rede de segurança**: mesmo que a invalidação falhe ou uma corrida
(seção 8) deixe um valor velho, o erro dura no máximo até o TTL.

## 7. Invalidação

Phil Karlton: "só há duas coisas difíceis em ciência da computação:
invalidação de cache e dar nome às coisas."

**Por que apagar e não atualizar o cache na escrita?** Apagar é idempotente e
simples: a próxima leitura recarrega do banco o valor correto. Atualizar o cache
exige montar o mesmo objeto que o repository monta, e duas escritas simultâneas
podem deixar o valor errado.

**Por que apagar a listagem inteira?** Uma listagem é uma consulta, e não temos
como saber quais combinações de filtro incluem o jogo alterado. A saída
segura é apagar todas as chaves com o prefixo `game:list:`.

**SCAN em vez de KEYS.** Para achar as chaves do prefixo existem dois comandos:

- `KEYS padrão` percorre **todo** o Redis de uma vez. Como a execução é
  single-thread, o Redis **para de atender qualquer outro comando** enquanto
  varre. Com muitas chaves, trava a aplicação.
- `SCAN cursor MATCH padrão COUNT n` varre em **lotes**, devolvendo um cursor
  para continuar até voltar a `0`. Entre um lote e outro, o Redis atende outros clientes.

Nosso `delByPrefix` usa SCAN em laço. É o mesmo problema que aparece em
produção, resolvido do jeito certo.

## 8. Consistência: o que pode dar errado

O cache é uma **cópia**, então pode ficar defasado. Os casos que conhecemos:

1. **Janela de defasagem**: entre a escrita no banco e a invalidação, uma
   leitura pode pegar o valor velho. É curta e aceitável.
2. **Corrida clássica do cache-aside**: a leitura A dá MISS e lê o banco
   (valor antigo); a escrita B atualiza o banco e invalida; a leitura A
   só então grava no cache o valor antigo. O cache fica velho **até o TTL**.
   Raro, e limitado pelo TTL.
3. **Categoria alterada**: renomear ou apagar uma categoria muda as
   listagens de jogos, mas a invalidação só dispara em escritas de `game`.
   Fica defasado por até 60 s. Limitação **conhecida e aceita**.
4. **Cache stampede**: quando uma chave muito popular expira, várias
   requisições dão MISS juntas e todas vão ao banco. Mitigações possíveis
   (não implementadas): lock por chave e TTL com variação aleatória.
5. **Dado sensível a frescor**: preço no checkout nunca deve vir do cache.
   O checkout precisa ler direto do repository.

Saber listar esses pontos é mais convincente do que dizer que "não tem problema".

## 9. Resiliência: o cache nunca pode derrubar a API

Princípio: cache é **otimização**, não dependência.

- `CacheService` captura qualquer erro do Redis. Se o `get` falha, devolve
  `null` e o fluxo segue como um MISS normal, indo ao MySQL.
- Se `set`/`del` falham, só registra no log. Uma escrita que já deu commit
  no MySQL **nunca** vira erro 500 por causa do Redis.
- `lazyConnect: true`: só conecta no primeiro comando.
- `maxRetriesPerRequest: 1` e `connectTimeout`: o comando falha rápido em vez
  de ficar preso numa fila esperando um Redis que não volta.
- Listener de `error`: sem ele o `ioredis` lança uma exceção não tratada e
  derruba o processo. O log sai uma vez por queda, para não inundar o console.
- Em `NODE_ENV=test` o cache fica desligado, para os testes de integração
  baterem sempre no MySQL e não lerem dados de uma execução anterior.

Isso se chama **fail-open** (ou degradação graciosa): quando o componente
auxiliar falha, o sistema fica mais lento, mas continua funcionando.

## 10. Limitações que escolhemos aceitar

- Sem `maxmemory`: o Redis do Docker não tem limite de memória nem política de
  remoção. Em produção se configuraria algo como `maxmemory` com `allkeys-lru`
  (remove as chaves menos usadas quando enche).
- Sem persistência garantida: cache pode ser perdido sem prejuízo.
- Sem proteção contra stampede.
- Instância única de Redis (sem réplica).

## 11. Como provar que funciona (demonstração)

```fish
docker compose up -d redis

curl -s localhost:3000/api/games/1      # MISS (primeira vez)
curl -s localhost:3000/api/games/1      # HIT

docker exec -it redisService redis-cli --scan --pattern 'game:*'   # lista as chaves
docker exec -it redisService redis-cli ttl game:id:1               # segundos restantes
docker exec -it redisService redis-cli info stats                  # keyspace_hits / keyspace_misses
```

Depois de editar o jogo pela API, o GET seguinte volta a dar MISS e a chave
`game:id:1` some e reaparece. Os logs `[Cache] HIT/MISS` com tempo (MOON-31)
são a evidência escrita para a rubrica.

## 12. Roteiro de apresentação (2 a 3 minutos)

1. **Problema**: o catálogo é lido muito mais do que alterado, e cada leitura repetia a mesma consulta no MySQL.
2. **Solução**: cache-aside com Redis. O service tenta o cache; no MISS busca no MySQL e guarda com TTL.
3. **Decisões**: só cacheamos o que tem repetição (detalhe e listagens simples), com TTL de 300 s e 60 s; invalidação por chave na escrita e por prefixo nas listagens; SCAN no lugar de KEYS.
4. **Resiliência**: se o Redis cair, a API segue funcionando pelo MySQL.
5. **Prova**: demonstrar MISS, HIT, edição e MISS de novo, mostrando as chaves e o TTL no `redis-cli`.
6. **Limites conhecidos**: defasagem de até o TTL e categoria alterada; escolhidos conscientemente.
7. **Próximo passo**: o mesmo Redis fará Pub/Sub entre os microsserviços (dois papéis, um serviço).

## 13. Perguntas que a banca pode fazer

**Por que cache-aside e não write-through?**
Porque o cache é opcional e só guarda o que foi pedido. Write-through gasta escrita com dados que talvez ninguém leia e acopla a escrita ao cache.

**E se o Redis cair?**
O `CacheService` trata a falha como MISS e a API continua pelo MySQL. Mais lenta, mas no ar.

**O cache pode mostrar dado desatualizado?**
Pode, por até o TTL (60 ou 300 s), e escolhemos isso conscientemente. A invalidação nas escritas reduz a janela, e o TTL garante que ela tem limite.

**Por que não cachear tudo?**
Porque cache só compensa com repetição. Chave com cardinalidade alta (busca livre, aleatório) quase nunca dá HIT e só gasta memória.

**Por que SCAN e não KEYS?**
O Redis executa comandos em uma thread. KEYS varre tudo de uma vez e bloqueia os outros clientes; SCAN varre em lotes.

**Por que apagar o cache na escrita em vez de atualizá-lo?**
É mais simples e mais seguro: a próxima leitura recarrega o valor correto do banco, sem risco de duas escritas deixarem o cache errado.

**O preço pode vir desatualizado no checkout? Hoje pode. O checkout não consulta o preço direto no banco, então o valor usado na compra pode estar defasado (se vier do cache, por até 300 s). É uma pendência conhecida: a correção é o checkout buscar o preço do jogo no MySQL a cada compra, sem passar pelo cache.

**Como vocês mediram o ganho?**
Com os logs de HIT/MISS e o tempo de resposta (MOON-31) e o `info stats` do Redis. O ganho absoluto é pequeno com pouco dado e banco local; o que se demonstra é o padrão e o comportamento correto.

## 14. Glossário rápido

- **HIT / MISS**: achou ou não achou no cache.
- **TTL**: tempo de vida da chave.
- **Invalidação**: remover ou marcar como inválida uma entrada velha.
- **Cache-aside / lazy loading**: a aplicação consulta o cache e o preenche sob demanda.
- **Cardinalidade**: quantidade de chaves distintas possíveis.
- **Stampede**: muitas requisições vão ao banco juntas quando uma chave popular expira.
- **Fail-open**: se o componente auxiliar falha, o sistema segue sem ele.
- **Single-thread**: um comando por vez; comandos lentos bloqueiam os demais.
- **Eviction**: remoção automática de chaves quando a memória enche.
