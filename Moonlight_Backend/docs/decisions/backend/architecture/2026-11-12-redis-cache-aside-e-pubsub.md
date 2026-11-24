# Redis: cache-aside para leitura e Pub/Sub para mensageria entre serviços

**Status:** Aceito (cache implementado na MOON-25; Pub/Sub em implementação na MOON-16)
**Data:** 2026-11-12 (revisado em 2026-11-20)

## Contexto
O backend é composto por uma API principal (monólito modular) e por
serviços com baixo acoplamento entre si, cada um com seu próprio banco
de dados (ver ADR de microsserviços Order e Notification). Dois
problemas aparecem nesse cenário:

1. **Leitura repetida.** O catálogo de jogos é consultado com muito mais
   frequência do que é alterado. A escrita é restrita (admin); todos os
   clientes leem. Ir ao banco a cada requisição para dados que quase
   não mudam é desperdício.
2. **Comunicação entre serviços.** O Order precisa avisar que um pedido
   mudou de estado, e o Notification precisa reagir a isso, sem que o
   Order espere resposta nem dependa de o Notification estar no ar para
   concluir o pedido.

O Redis atende às duas necessidades, em funções separadas.

## Decisão

### Mensageria: Pub/Sub
A comunicação assíncrona entre serviços usa o Pub/Sub do Redis. O Order
publica `order.created` quando o pedido é criado e `order.paid` quando o
pagamento é aprovado. O Notification assina `order.paid` e processa o
evento ao recebê-lo. O publicador não conhece quem consome, e o
consumidor não responde ao publicador.

Escolhemos eventos específicos em vez de um evento genérico de mudança
de status: o consumidor assina só o que lhe interessa, sem filtrar por
status, e cada payload é tipado. O custo é um tipo de evento novo para
cada estado relevante.

**Abstração do barramento.** O código de negócio não usa o Redis
diretamente. Ele depende de uma interface `EventBus` (`publish`,
`subscribe`, `close`), em `shared/events`, com dois adaptadores:
`InMemoryEventBus` (testes e execução em um processo só) e
`RedisEventBus` (Pub/Sub de verdade). Trocar um pelo outro não muda
nenhum service.

**Envelope e contrato de entrega.** Todo evento trafega em um envelope
`{ id_envelope, name, occurredAt, payload }`; o `id_envelope` é um UUID por evento.
Os dois adaptadores seguem o mesmo contrato:
* cada evento chega a todos os assinantes ativos (fan-out);
* entrega *at-most-once*, sem persistência e sem replay;
* o erro de um handler não chega ao publicador nem aos outros handlers;
* `publish` devolve o `id` do evento, para correlacionar os logs.

**Logs.** Cada serviço registra a publicação, o consumo e a falha de
um evento (`PUBLISH`, `CONSUME`, `ERROR`) com o nome e o `id`, de modo
que um mesmo evento possa ser acompanhado entre os dois serviços. O
payload não vai para o log, porque contém dados pessoais do cliente.

**Idempotência.** O Notification grava o `id` do evento com restrição de
unicidade; um evento repetido não gera um segundo e-mail.

### Cache: cache-aside
O cache de leitura segue o padrão cache-aside, controlado pela própria
aplicação:

1. A requisição consulta o Redis pela chave.
2. Se existe (*hit*), devolve o valor do cache.
3. Se não existe (*miss*), consulta o banco, grava o resultado no Redis
   com TTL e devolve.
4. Quando o dado é alterado (criação, edição ou remoção de jogo pelo
   admin), as chaves correspondentes são **invalidadas** depois do
   *commit* no banco; a próxima leitura repopula o cache.

**Escopo implementado:** detalhe de um jogo e listagem paginada do
catálogo. A lista de categorias não é cacheada por enquanto e fica como
evolução.

**Chaves e TTL:**
* `game:id:{id}`: detalhe, TTL de 300 s;
* `game:list:{filtros}`: listagem, TTL de 60 s. A chave é o JSON de
  `page`, `limit`, `admin` e dos filtros, sempre na mesma ordem, de modo
  que a mesma busca gera a mesma chave. O `admin` faz parte da chave
  porque o admin enxerga jogos inativos e o público não.

**O que não entra no cache:** listagem aleatória (`random`), busca por
título e consulta sem paginação, porque geram chaves quase sempre únicas
e quase nunca dão *hit*; e jogo inexistente, para que um 404 não fique
preso até o TTL.

**Invalidação:** na criação, edição e remoção de jogo, apaga-se o detalhe
afetado e todas as chaves com o prefixo `game:list:`, usando `SCAN` em
vez de `KEYS`, porque o Redis executa comandos em uma única thread e o
`KEYS` bloquearia os demais clientes.

**Falha do Redis.** O `CacheService` (injetado pelo container) trata
qualquer erro do Redis como *miss* ou ignora a escrita. O cliente é
configurado para falhar rápido: sem fila offline de comandos e com
limite de 250 ms por comando. Sem isso, um Redis fora do ar deixava a
API lenta mesmo sem derrubá-la, o que foi percebido no CI.

Cada serviço usa o cache apenas para os dados do seu próprio banco.
Nenhum serviço lê o cache de outro como se fosse fonte de verdade.

## Por que cache-aside para este projeto
- **O perfil de acesso combina.** O catálogo é lido o tempo todo e
  escrito raramente, que é o cenário em que cache dá mais retorno.
- **Só guarda o que é usado.** O cache é preenchido por demanda: jogos
  que ninguém abre não ocupam memória.
- **O sistema continua funcionando sem o Redis.** Como a fonte de
  verdade é sempre o banco, uma falha no cache vira *miss* e a
  requisição vai ao banco. O cache melhora o desempenho, mas não
  vira ponto único de falha para leitura.
- **Respeita o banco por serviço.** A aplicação decide o que cachear e
  quando invalidar, sem acoplar o cache ao esquema de outro serviço.
- **É simples de implementar e de explicar.** Poucas linhas na camada de
  service, sem infraestrutura adicional além do Redis que também é usado
  para o Pub/Sub.

## Consequências
- O catálogo fica mais rápido e o banco recebe menos leituras repetidas.
  Medido localmente, o ganho é de cerca de 2x na mediana (aproximadamente
  0,8 ms contra 1,7 ms); é pequeno porque o MySQL está na mesma máquina e
  a consulta é simples, e tende a crescer com banco remoto, consultas
  pesadas e muitas requisições simultâneas.
- Existe uma janela em que o cache pode estar desatualizado, entre a
  alteração do dado e a invalidação (ou até o TTL expirar). Para dados
  de catálogo isso é aceitável. Renomear ou apagar uma categoria, por
  exemplo, deixa as listagens de jogos desatualizadas por até 60 s.
- Para dados que exigem valor exato, como o preço no momento do
  checkout, a leitura deve ir ao banco e não ao cache. Garantir isso no
  checkout é o objetivo da MOON-44.
- O Pub/Sub não guarda mensagens: um evento publicado enquanto o
  Notification está fora do ar não é entregue a ele depois. Esse limite
  é aceito, e o log de publicação e consumo permite identificar eventos
  que foram publicados e não chegaram a ser consumidos. Persistência
  (Redis Streams) fica como evolução.
- Uma conexão Redis que assina um canal fica dedicada à assinatura e não
  executa outros comandos. Cada serviço precisa de uma conexão exclusiva
  para assinar e de outra para o cache e para publicar.
- Toda escrita em jogo passa a ter a obrigação de invalidar as chaves
  afetadas. Esquecer isso gera dado velho no catálogo; a regra fica no
  método de service que faz a escrita.
- O contrato do `EventBus` obriga todo adaptador novo a respeitar as
  mesmas garantias; os testes de contrato verificam isso.
