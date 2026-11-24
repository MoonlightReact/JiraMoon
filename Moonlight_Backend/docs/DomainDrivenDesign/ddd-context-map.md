# Moonlight — Estilos Arquiteturais e DDD

> Versão: 1.0 · 2026-11-24

---

## Estilo Arquitetural

O Moonlight adota **monólito modular** como núcleo (API Principal) com dois **microsserviços** auxiliares (Order Service e Notification Service), conectados por eventos assíncronos via Redis Pub/Sub.

| Componente | Estilo | Justificativa |
|---|---|---|
| API Principal | Monólito modular | Reduz a complexidade operacional; fronteiras entre módulos são reforçadas por testes de arquitetura; migração incremental para microsserviços é possível |
| Order Service | Microsserviço | Ciclo de vida de pedidos e integração com pagamento têm ritmo de mudança independente; banco separado (orders_db) evita acoplamento de dados |
| Notification Service | Microsserviço | Consumidor puro de eventos; sem HTTP público; isolado para que falhas de entrega não afetem o fluxo de compra |

---

## Context Map

Mapa de relacionamentos entre os Bounded Contexts do Moonlight.

```
┌─────────────────────────────────────────────────────────────────┐
│  [Catálogo]  ─── Conformista ───►  [Identidade]                 │
│      │                                   │                       │
│      │ Shared Kernel (snapshot)           │ ACL (JWT decode)      │
│      ▼                                   ▼                       │
│  [Pedidos]  ◄── ACL (webhook) ──  [Pagamentos] (externo)        │
│      │                                                           │
│      │ Publicador / Assinante (Pub/Sub)                          │
│      ▼                                                           │
│  [Notificações]  ──► [E-mail] (externo)                         │
└─────────────────────────────────────────────────────────────────┘
```

| Bounded Context | Responsável | Relacionamento com outros contexts |
|---|---|---|
| **Catálogo** | API Principal (`game`, `category`) | Fornece snapshot de preço/título para Pedidos (Shared Kernel); lê identidade via JWT |
| **Identidade** | API Principal (`auth`, `user`, `role`) | Autenticação e RBAC para todos os contextos internos |
| **Pedidos** | Order Service | Consome snapshot do Catálogo; integra Pagamentos via ACL (webhook); publica eventos para Notificações |
| **Notificações** | Notification Service | Assina eventos do contexto de Pedidos via Redis Pub/Sub; aciona e-mail externo |
| **Pagamentos** | Mercado Pago (externo) | Separado por ACL; o sistema nunca expõe sua lógica interna |

---

## Bounded Contexts — Definição

### Catálogo

**Responsabilidade:** gerenciar jogos, categorias, preços e disponibilidade para o público e para o admin.

**Subdomínios:**
- Gestão de jogos (cadastro, edição, aprovação, status)
- Gestão de categorias
- Busca e filtragem paginada
- Cache de leituras (Redis cache-aside)

**Fronteira:** qualquer leitura de jogo ou categoria passa pelo `GameService` ou `CategoryService`; outros contextos não acessam diretamente as tabelas `games` / `categories`.

---

### Identidade

**Responsabilidade:** autenticação de usuários, controle de acesso baseado em papéis (RBAC) e ciclo de vida de contas.

**Subdomínios:**
- Registro e login (JWT)
- Gerenciamento de roles e permissões
- Deleção (soft/hard) e status de usuário

**Fronteira:** outros contextos consomem identidade somente via token JWT decodificado no middleware; nunca acessam tabelas de usuário diretamente.

---

### Pedidos

**Responsabilidade:** ciclo de vida de pedidos desde o checkout até a confirmação do pagamento.

**Subdomínios:**
- Criação de pedido (snapshot de preço e cliente)
- Integração com Mercado Pago (criação e consulta de pagamento)
- Atualização de status por webhook
- Biblioteca do usuário (jogos aprovados)

**Fronteira:** o banco `orders_db` pertence exclusivamente a este contexto; a API Principal não acessa `orders_db` diretamente.

---

### Notificações

**Responsabilidade:** reagir a eventos de domínio e entregar notificações ao usuário.

**Subdomínios:**
- Consumo de eventos via Redis Pub/Sub
- Registro de notificações em `notifications_db`
- Envio de e-mail (SMTP)

**Fronteira:** sem HTTP público; sem acesso a nenhum outro banco.

---

## Entities, Value Objects e Aggregates — Contexto: Pedidos

### Aggregate Root: `Order`

```
Order (Aggregate Root)
├── id: number                      — identidade persistida
├── external_reference: string      — Value Object (referência única no Mercado Pago)
├── status: OrderStatus             — Value Object (enum: pending | approved | cancelled)
├── customer: CustomerSnapshot      — Value Object (imutável após criação)
│   ├── id_user: number
│   ├── customer_name: string
│   └── customer_email: string
├── items: OrderItem[]              — Entity (pertence ao aggregate)
│   ├── id_game: number
│   ├── title: string               — snapshot no momento da compra
│   ├── price: number               — snapshot no momento da compra
│   └── image: string               — snapshot no momento da compra
└── created_at: Date
```

**Regras de invariante:**
- Um `Order` só pode transitar para `approved` uma vez (`UPDATE ... WHERE status <> 'approved'`).
- `items` nunca está vazio; preço e título são capturados no instante da compra (imutáveis).
- `external_reference` é único no sistema (constraint UNIQUE no banco).

### Value Objects

| Value Object | Por que não é Entity | Regra de negócio |
|---|---|---|
| `CustomerSnapshot` | Imutável após a criação; identidade não importa após o commit | Nome e e-mail do cliente no momento da compra, independente de alterações futuras no cadastro |
| `ItemSnapshot` | Preço e título congelados; não rastreia o jogo vivo | Garante que alterações de preço não afetam pedidos já realizados |
| `ExternalReference` | String opaca, sem identidade própria | Controla idempotência no Mercado Pago e no UPDATE condicional |
| `OrderStatus` | Enum sem identidade | Restringe transições inválidas de status |

### Entities

| Entity | Identidade | Ciclo de vida |
|---|---|---|
| `Order` | `id` (PK auto-increment) | Criado no checkout; destruído apenas por auditoria/LGPD |
| `OrderItem` | `(id_order, id_game)` composto | Pertence ao Order; nunca alterado após criação |
