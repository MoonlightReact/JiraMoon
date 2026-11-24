# Moonlight — Quality Scenarios

> Versão: 1.0 · 2026-11-24

Quality Scenarios do Moonlight pelo modelo ASR (Estímulo → Artefato → Resposta → Medida). Cada cenário justifica uma decisão arquitetural já implementada.

---

## Desempenho

O catálogo é lido com muito mais frequência do que alterado; o Redis reduz a carga no MySQL e a latência percebida pelo jogador.

| # | Fonte do estímulo | Estímulo | Artefato | Ambiente | Resposta | Medida de resposta |
|---|---|---|---|---|---|---|
| QS-01 | Jogador | Requisita `GET /api/games/:id` repetidamente | API Principal + Redis | Operação normal | Retorna o jogo do cache (HIT) sem consultar o MySQL | Latência < 20 ms em 95% dos HITs; zero queries extras no MySQL |
| QS-02 | Jogador | Primeira requisição após expiração do TTL (MISS) | API Principal + MySQL + Redis | Operação normal | Busca no MySQL, armazena no Redis com TTL 300 s, responde | Latência < 200 ms; chave repovoada no Redis |
---

## Disponibilidade

O Redis é uma otimização, não uma dependência; o sistema degrada graciosamente quando componentes auxiliares falham.

| # | Fonte do estímulo | Estímulo | Artefato | Ambiente | Resposta | Medida de resposta |
|---|---|---|---|---|---|---|
| QS-03 | Falha de infraestrutura | Redis fica indisponível | API Principal (CacheService) | Operação degradada | `CacheService.get` retorna `null`; fluxo continua como MISS; MySQL responde normalmente | API permanece no ar; nenhum erro 500; tempo de resposta aumenta mas não há interrupção |
| QS-04 | Falha de infraestrutura | MySQL principal fica indisponível | API Principal | Falha crítica | Requisições que precisam do banco retornam 503; requisições em cache ainda funcionam durante o TTL | Dados em cache servem até 300 s após a falha; erros identificados por código 503 |
| QS-05 | Falha de infraestrutura | Order Service fica indisponível | API Principal | Falha parcial | Checkout retorna erro tratado (não 500 genérico); catálogo, login e biblioteca continuam funcionando | Escopo da falha isolado ao módulo de compra; outros módulos não são afetados |

---

## Segurança

O RBAC da API Principal e a rede interna do Docker Compose são as duas camadas de controle de acesso do sistema.

| # | Fonte do estímulo | Estímulo | Artefato | Ambiente | Resposta | Medida de resposta |
|---|---|---|---|---|---|---|
| QS-06 | Usuário não autenticado | Chama `GET /api/admin/games` sem token JWT | API Principal (auth.middleware) | Operação normal | Middleware rejeita a requisição antes de chegar ao controller | HTTP 401; nenhum acesso ao banco ocorre |
| QS-07 | Jogador (role CUSTOMER) | Tenta `DELETE /api/games/:id` | API Principal (role.middleware) | Operação normal | Middleware verifica role; acesso negado | HTTP 403; nenhuma alteração no banco |
| QS-08 | Agente externo | Acessa `PATCH /orders/:ref/status` pelo Nginx público (porta 443) | Nginx + Order Service | Tentativa de fraude | A rota não existe no Nginx público; Order Service só aceita tráfego da rede interna do Compose | HTTP 404 pelo Nginx; Order Service nunca recebe a requisição |

---

## Modificabilidade

O desacoplamento via Pub/Sub (Redis) permite adicionar consumidores sem alterar publicadores.

| # | Fonte do estímulo | Estímulo | Artefato | Ambiente | Resposta | Medida de resposta |
|---|---|---|---|---|---|---|
| QS-10 | Desenvolvedor | Adiciona um novo tipo de notificação (ex.: `order.refunded`) | Notification Service + Redis (Pub/Sub) | Tempo de desenvolvimento | Apenas o Notification Service precisa ser alterado; Order Service publica o evento sem mudanças | Zero alterações na API Principal ou no Order Service; novo evento ativo após redeploy do Notification Service |
| QS-11 | Desenvolvedor | Adiciona um novo módulo ao monólito (ex.: `wishlist`) | API Principal (container.ts) | Tempo de desenvolvimento | O módulo é registrado via injeção de dependência sem alterar módulos existentes | Nenhum módulo existente é modificado; fronteiras validadas pelos testes de arquitetura |
