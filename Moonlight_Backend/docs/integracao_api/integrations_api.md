# Integração, APIs e Dados

> Projeto: Moonlight · 2026-11-24

---

## OpenAPI — Endpoints Principais

> Documentação no formato OpenAPI 3.0 (esquema simplificado). Em produção, gerar via `swagger-jsdoc` ou equivalente a partir dos comentários no código.

---

### Autenticação

```yaml
POST /auth/login
  Summary: Autentica um usuário e retorna JWT
  Request body:
    email: string (required)
    password: string (required)
  Responses:
    200: { token: string, user: { id, name, email, role } }
    401: { message: "Credenciais inválidas" }

POST /auth/register
  Summary: Registra novo usuário
  Request body:
    name: string (required)
    email: string (required)
    password: string (required)
  Responses:
    201: { token: string, user: { id, name, email, role } }
    409: { message: "E-mail já cadastrado" }
```

---

### Catálogo (Jogos)

```yaml
GET /games
  Summary: Lista jogos (paginado, com cache Redis)
  Query params:
    page: integer (default: 1)
    limit: integer (default: 20)
    category: string (optional)
  Responses:
    200: { data: Game[], total: integer, page: integer }
  Cache: Redis TTL 60s (lista)

GET /games/:id
  Summary: Detalhe de um jogo (com cache Redis)
  Path params:
    id: integer (required)
  Responses:
    200: Game
    404: { message: "Jogo não encontrado" }
  Cache: Redis TTL 300s (detalhe)

POST /games
  Summary: Cadastra novo jogo (admin)
  Security: Bearer JWT + role ADMIN
  Request body:
    title: string (required)
    description: string
    price: number (required)
    categoryId: integer (required)
    imageUrl: string
  Responses:
    201: Game
    403: { message: "Acesso negado" }

PUT /games/:id
  Summary: Atualiza jogo (admin)
  Security: Bearer JWT + role ADMIN
  Responses:
    200: Game
    404: { message: "Jogo não encontrado" }

DELETE /games/:id
  Summary: Remove jogo (admin)
  Security: Bearer JWT + role ADMIN
  Responses:
    204: (sem corpo)
    404: { message: "Jogo não encontrado" }
```

---

### Categorias

```yaml
GET /categories
  Summary: Lista todas as categorias
  Responses:
    200: Category[]
  Cache: Redis TTL 60s

POST /categories
  Summary: Cria categoria (admin)
  Security: Bearer JWT + role ADMIN
  Request body:
    name: string (required)
  Responses:
    201: Category
    403: { message: "Acesso negado" }
```

---

### Pedidos (Proxy → Order Service)

```yaml
POST /orders
  Summary: Inicia checkout (cria pedido + link Mercado Pago)
  Security: Bearer JWT
  Request body:
    items:
      - gameId: integer (required)
        quantity: integer (default: 1)
  Responses:
    201:
      orderId: string
      checkoutUrl: string   # URL de pagamento do Mercado Pago
    400: { message: "Carrinho vazio ou item inválido" }
    401: { message: "Não autenticado" }

GET /orders/:id
  Summary: Detalhe de um pedido
  Security: Bearer JWT (owner ou ADMIN)
  Responses:
    200: Order
    403: { message: "Sem permissão" }
    404: { message: "Pedido não encontrado" }

GET /orders
  Summary: Lista pedidos do usuário autenticado
  Security: Bearer JWT
  Responses:
    200: Order[]
```

---

### Webhook Mercado Pago (Order Service — interno)

```yaml
POST /webhooks/mercadopago
  Summary: Recebe notificação de pagamento do Mercado Pago
  Note: Endpoint interno, não autenticado por JWT.
        Validado por assinatura HMAC do Mercado Pago.
  Request body:
    type: "payment"
    data: { id: string }
  Responses:
    200: (processado)
    200: (já processado — idempotente)
    500: (erro ao processar)
```

---

### Schemas de dados

```yaml
Game:
  id: integer
  title: string
  description: string
  price: number
  imageUrl: string
  category: Category
  createdAt: datetime

Category:
  id: integer
  name: string

Order:
  id: string (UUID)
  external_reference: string
  status: "pending" | "approved" | "rejected" | "cancelled"
  total: number
  customer:
    id: integer
    name: string
    email: string
  items:
    - gameId: integer
      title: string       # snapshot — valor no momento da compra
      price: number       # snapshot — valor no momento da compra
      imageUrl: string    # snapshot — valor no momento da compra
      quantity: integer
  createdAt: datetime
  updatedAt: datetime
```

---

## Fluxo de Integração entre Serviços

```
Frontend (React)
     │  HTTPS
     ▼
  Nginx (443)
     │  HTTP
     ▼
API Principal (Node.js)  ←──── auth.middleware + role.middleware
     │                              │
     │  HTTP (loopback:8080)        │  Redis cache (RESP)
     ▼                              ▼
  Nginx (8080)               Redis (Cache + Pub/Sub)
     │                              ▲
     ├──→ Order Service             │  Pub/Sub (order.created / order.paid)
     │         │                    │
     │         │── SQL ──→ orders_db (MySQL)
     │         │── HTTPS ──→ Mercado Pago (externo)
     │         └── Publica em Redis Pub/Sub ──────────────────┐
     │                                                         ▼
     └──→ Notification Service                    Notification Service
               │── SQL ──→ notifications_db (MySQL)   (subscribes order.paid)
               └── SMTP ──→ Provedor de e-mail (externo)
```

---

## ADR — Escolha do Banco de Dados

> Ver arquivo separado: [`adr_banco_de_dados.md`](./adr_banco_de_dados.md)

**Resumo da decisão:**
- **MySQL 8** para todos os bancos (`moonlight_db`, `orders_db`, `notifications_db`)
- **Database-per-service**: cada microsserviço com seu próprio banco isolado
- **Snapshot pattern**: `order_items` armazena `title`, `price`, `image` no momento da compra para evitar JOINs cross-database
- **Redis** como camada de cache (TTL 60s listas / 300s detalhes) e message broker (Pub/Sub)
