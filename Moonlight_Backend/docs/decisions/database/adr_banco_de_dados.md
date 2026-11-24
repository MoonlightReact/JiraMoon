# ADR — Escolha do Banco de Dados

> Status: Aceito · 2026-11-24  
> Contexto: Moonlight — API Principal, Order Service, Notification Service

---

## Contexto

O Moonlight precisa armazenar dados relacionais com integridade transacional (pedidos + itens em uma única transação), controle de acesso por papel (RBAC), histórico de notificações e catálogo de jogos com categorias. Cada microsserviço tem seu próprio banco para garantir o isolamento do domínio.

---

## Decisão

**MySQL 8** como SGBD para todos os bancos do sistema:
- `moonlight_db` — API Principal (usuários, jogos, categorias, roles)
- `orders_db` — Order Service (pedidos, itens de pedido)
- `notifications_db` — Notification Service (histórico de notificações)

---

## Justificativa

| Critério | MySQL | PostgreSQL | MongoDB |
|---|---|---|---|
| JOINs e FKs | ✓ | ✓ | ✗ (sem JOINs nativos) |
| Familiaridade da equipe | Alta | Baixa | Média |
| Necessidade de dados não-estruturados | Não | Não | Seria o único ganho |

**Por que não PostgreSQL:** MySQL atende todos os requisitos; a curva de aprendizado adicional não justifica a troca. As decisões de migração para PostgreSQL ficam abertas para uma v2.

**Por que não MongoDB:** o domínio do Moonlight é fortemente relacional (jogo ↔ categoria, pedido ↔ itens, usuário ↔ roles). Dados não-estruturados não são um requisito presente ou previsto.

**Por que database-per-service:** cada microsserviço (Order Service, Notification Service) tem seu próprio banco para:
1. Evitar acoplamento de dados entre serviços.
2. Permitir deploys e migrações independentes.
3. Garantir que uma migração no `orders_db` não afete o `moonlight_db`.

---

## Consequências

**Positivas:**
- Integridade referencial dentro de cada banco garantida por FKs.
- Transações atômicas no checkout (pedido + itens em um único `BEGIN` / `COMMIT`).
- Equipe já conhece MySQL; ferramentas de migração (`migrate.ts`) já funcionam.

**Negativas / trade-offs aceitos:**
- Sem JOINs entre bancos: o Order Service não pode fazer JOIN com `games` do `moonlight_db`. Solução adotada: **snapshot** de título, preço e imagem no momento da compra (`order_items`).
- Dados duplicados intencionalmente (snapshot vs. catálogo vivo): aceito, pois preço e título no pedido devem ser imutáveis.
- Sem réplica de leitura: ponto de melhoria para produção real.

---

## Alternativas descartadas

| Alternativa | Motivo da rejeição |
|---|---|
| PostgreSQL como SGBD único | Sem ganho funcional; custo de aprendizado desnecessário no prazo atual |
| MongoDB para notificações | Histórico de notificações é tabular; SQL é suficiente e mais simples |
| SQLite para Order Service | Sem suporte a concorrência real; inaceitável para microsserviço em produção |
| Banco compartilhado entre serviços | Viola o princípio de isolamento de domínio; cria acoplamento de deploy |
