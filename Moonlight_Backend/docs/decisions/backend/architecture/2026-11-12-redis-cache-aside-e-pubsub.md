# Redis: cache-aside para leitura e Pub/Sub para mensageria entre serviços

**Status:** Proposto
**Data:** 2026-11-12

## Contexto
O backend é composto por serviços com baixo acoplamento entre si, cada
um com seu próprio banco de dados (ver ADR de microsserviços Order e
Notification). Dois problemas aparecem nesse cenário:

1. **Leitura repetida.** O catálogo de jogos e as categorias são
   consultados com muito mais frequência do que são alterados. Só o
   admin escreve; todos os clientes leem. Ir ao banco a cada requisição
   para dados que quase não mudam é desperdício.
2. **Comunicação entre serviços.** O Order precisa avisar que um pedido
   mudou de estado, e o Notification precisa reagir a isso, sem que o
   Order espere resposta nem dependa de o Notification estar no ar para
   concluir o pedido.

O Redis atende às duas necessidades, em funções separadas.

## Decisão

### Mensageria: Pub/Sub
A comunicação assíncrona entre serviços usa o Pub/Sub do Redis. O Order
publica um evento em um canal quando o estado de um pedido muda
(`order.status-changed`). O Notification assina esse canal e processa o
evento ao recebê-lo. O publicador não conhece quem consome, e o
consumidor não responde ao publicador.

Cada evento carrega um `eventId`. Cada serviço registra em log a
publicação, o recebimento e a falha (`publicado`, `recebido`, `falhou`),
de modo que um mesmo evento possa ser acompanhado entre os dois
serviços.

### Cache: cache-aside
O cache de leitura segue o padrão cache-aside, controlado pela própria
aplicação:

1. A requisição consulta o Redis pela chave.
2. Se existe (*hit*), devolve o valor do cache.
3. Se não existe (*miss*), consulta o banco, grava o resultado no Redis
   com TTL e devolve.
4. Quando o dado é alterado (criação, edição ou remoção de jogo ou
   categoria pelo admin), a chave correspondente é **invalidada**; a
   próxima leitura repopula o cache.

Escopo inicial do cache: lista de jogos do catálogo, detalhe de um jogo
e lista de categorias. As chaves seguem um padrão por recurso, por
exemplo `game:{id}`, `games:list:{filtros}` e `categories:list`. O TTL
é curto (da ordem de minutos) como rede de segurança caso uma
invalidação falhe.

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
  service, sem infraestrutura adicional além do Redis que já será usado
  para o Pub/Sub.

## Consequências
- O catálogo fica mais rápido e o banco recebe menos leituras repetidas.
- Existe uma janela em que o cache pode estar desatualizado, entre a
  alteração do dado e a invalidação (ou até o TTL expirar). Para dados
  de catálogo isso é aceitável. Para dados que exigem valor exato (por
  exemplo, preço no momento do checkout), a leitura deve ir ao banco e
  não ao cache.
- O Pub/Sub não guarda mensagens: um evento publicado enquanto o
  Notification está fora do ar não é entregue a ele depois. Esse limite
  é aceito, e o log de publicação e recebimento permite identificar
  eventos que foram publicados e não chegaram a ser recebidos.
- Uma conexão Redis que assina um canal fica dedicada à assinatura e não
  executa outros comandos. Cada serviço precisa de uma conexão para o
  Pub/Sub e outra para o cache.
- Toda escrita em jogo ou categoria passa a ter a obrigação de
  invalidar as chaves afetadas. Esquecer isso gera dado velho no
  catálogo; a regra deve ficar no método de service que faz a escrita.
