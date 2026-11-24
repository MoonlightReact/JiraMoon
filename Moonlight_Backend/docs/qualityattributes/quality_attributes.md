# Atributos de Qualidade, Resiliência e Observabilidade

> Projeto: Moonlight · 2026-11-24

---

## 1. SLOs e SLIs

### Definições

| Sigla | Conceito |
|---|---|
| **SLI** (Service Level Indicator) | Métrica medida: o que realmente acontece |
| **SLO** (Service Level Objective) | Meta sobre o SLI: o que se compromete a garantir |
| **SLA** | Acordo formal (externo); não definido nesta fase do projeto |

---

### SLIs e SLOs por serviço

#### API Principal

| SLI | Medição | SLO |
|---|---|---|
| Latência p95 — cache HIT | Tempo de resposta em endpoints de catálogo com Redis HIT | ≤ 20 ms em 95 % das requisições |
| Latência p95 — cache MISS | Tempo de resposta em endpoints de catálogo com Redis MISS | ≤ 200 ms em 95 % das requisições |
| Taxa de erro HTTP 5xx | Respostas 5xx / total de requisições | ≤ 1 % em janela de 5 min |
| Disponibilidade | Uptime mensurado por health check `/health` | ≥ 99,5 % mensal |

#### Order Service

| SLI | Medição | SLO |
|---|---|---|
| Latência de checkout (p95) | Da requisição POST `/orders` até resposta 201 | ≤ 500 ms em 95 % dos casos |
| Taxa de erro em pagamentos | Erros ao invocar Mercado Pago / total de tentativas | ≤ 2 % |
| Idempotência de webhook | Processamento duplo do mesmo `external_reference` | 0 % de duplicidade (garantido por `UPDATE ... WHERE status <> 'approved'`) |

#### Notification Service

| SLI | Medição | SLO |
|---|---|---|
| Latência de entrega de e-mail | Do evento `order.paid` até chamada ao provedor SMTP | ≤ 5 s em 90 % dos casos |
| Taxa de eventos processados | Eventos `order.paid` consumidos sem erro / total publicados | ≥ 99 % |

#### Redis

| SLI | Medição | SLO |
|---|---|---|
| Cache HIT ratio | Hits / (Hits + Misses) | ≥ 70 % em operação normal |
| Disponibilidade | Falhas capturadas pelo fail-open / total de requisições | Tolerado: serviço continua mesmo com Redis down |

---

## 2. Estratégias de Resiliência

### 2.1 Fail-Open (Redis)

**Onde:** `src/shared/cache/` — cliente Redis da API Principal.

**Comportamento:** Se a conexão com Redis falhar (timeout ou erro de rede), a aplicação serve a requisição diretamente do banco de dados sem retornar erro para o cliente.

```
Requisição → Tenta Redis → Erro? → Log "cache indisponível" → Consulta MySQL → Responde normalmente
```

**Configuração relevante:**
```
maxRetriesPerRequest: 1   // não trava a thread em retentativas longas
lazyConnect: true         // conexão só é estabelecida na primeira chamada
```

**Consequência aceita:** Durante falha de Redis, todas as requisições vão ao MySQL, aumentando latência. O sistema permanece disponível.

---

### 2.2 Idempotência no Webhook (Order Service)

**Onde:** `Moonlight_OrderService/src/` — handler do webhook do Mercado Pago.

**Problema:** O Mercado Pago pode reenviar o mesmo webhook (`order.paid`) mais de uma vez.

**Solução:**
```sql
UPDATE orders
SET status = 'approved'
WHERE external_reference = ?
  AND status <> 'approved'
```

Se `affectedRows === 0`, o pedido já foi processado. O serviço retorna 200 sem publicar o evento `order.paid` novamente, evitando notificações duplicadas.

---

### 2.3 Isolamento de Falha por Database-Per-Service

**Onde:** Separação de `moonlight_db`, `orders_db`, `notifications_db`.

**Comportamento:** Uma falha ou lentidão no `orders_db` não afeta a API Principal (catálogo, autenticação). Os domínios são independentes.

---

### 2.4 Gateway Interno (Nginx na porta 8080)

**Onde:** Nginx configurado para escutar em `localhost:8080` (loopback only).

**Comportamento:** Order Service e Notification Service não são acessíveis diretamente pela internet. Toda chamada a esses serviços passa pelo Nginx interno, que só aceita conexões originadas na mesma máquina.

**Consequência:** Mesmo que a API Principal fique indisponível, o Order Service não fica exposto publicamente.

---

### 2.5 Publicação de Evento Após Commit

**Onde:** `Moonlight_OrderService/src/` — criação de pedido.

**Comportamento:** O evento `order.created` é publicado no Redis Pub/Sub somente após o `COMMIT` da transação no banco. Se a publicação falhar, o pedido já está salvo; a falha é logada mas não causa rollback.

**Trade-off aceito:** Notificação pode não ser enviada em caso de falha pós-commit. Aceitável nesta fase; uma fila com dead-letter seria a evolução natural.

---

### 2.6 Snapshot de Dados de Compra

**Onde:** Tabela `order_items` no `orders_db`.

**Comportamento:** No momento do checkout, `title`, `price` e `image` do jogo são copiados para `order_items`. Alterações futuras no catálogo não afetam pedidos já realizados.

**Resiliência obtida:** Sem dependência de JOIN cross-database; histórico de pedidos é autocontido.

---

## 3. Plano de Observabilidade

### 3.1 Health Endpoints

| Serviço | Endpoint | O que verifica |
|---|---|---|
| API Principal | `GET /health` | Resposta 200 simples (processo vivo) |
| Order Service | `GET /health` | Resposta 200 simples |
| Notification Service | `GET /health` | Resposta 200 simples |

> **Evolução sugerida:** health checks compostos que verifiquem conexão com MySQL e Redis, retornando 503 se dependência crítica estiver indisponível.

---

### 3.2 Logs Estruturados

#### Eventos obrigatórios de log

| Evento | Nível | Campos adicionais |
|---|---|---|
| Cache HIT | `info` | `key`, `ttl_remaining` |
| Cache MISS | `info` | `key`, `source: "mysql"` |
| Redis indisponível (fail-open) | `warn` | `error_message` |
| Pedido criado | `info` | `order_id`, `user_id`, `total` |
| Webhook recebido | `info` | `external_reference`, `status` |
| Evento publicado (Pub/Sub) | `info` | `channel`, `event_type` |
| Evento consumido (Pub/Sub) | `info` | `channel`, `event_type`, `order_id` |
| Erro de pagamento | `error` | `external_reference`, `error_message` |
| Falha no envio de e-mail | `error` | `order_id`, `recipient`, `error_message` |

---

### 3.3 Métricas Redis

(risco assumido por enquanto é, nao configurar limite de memoria por ser uma
entrega academica de aprendizado)
O Redis expõe métricas via comando `INFO`. As principais a monitorar:

```
INFO stats
→ keyspace_hits       # total de acertos de cache
→ keyspace_misses     # total de erros de cache

INFO memory
→ used_memory_human   # uso atual de memória
→ maxmemory_human     # limite configurado

INFO clients
→ connected_clients   # clientes conectados simultaneamente
```

**HIT Ratio calculado:**
```
hit_ratio = keyspace_hits / (keyspace_hits + keyspace_misses) * 100
```

---

### 3.4 Alertas Sugeridos

| Condição | Ação |
|---|---|
| `hit_ratio < 50%` por mais de 5 min | Verificar TTL e padrões de invalidação |
| Taxa de erro 5xx > 1% | Investigar logs do serviço afetado |
| `/health` retorna não-200 por 2 verificações consecutivas | Alerta de serviço degradado |
| `connected_clients` próximo do limite do Redis | Rever pooling de conexões |
| Evento `order.paid` sem notificação em 2min | Verificar Notification Service e conexão Pub/Sub |

---

### 3.5 Ferramentas (baseline mínimo)

| Necessidade | Ferramenta sugerida (open-source) |
|---|---|
| Agregação de logs | Loki + Grafana |
| Métricas de aplicação | Prometheus + Grafana |
| Métricas Redis | `redis_exporter` → Prometheus |
| Health check externo | Uptime Kuma |
| Rastreamento distribuído (futuro) | OpenTelemetry + Jaeger |

> Para o escopo atual (desenvolvimento + apresentação), `console.log` estruturado + Redis `INFO` manual + `/health` endpoints cobre os requisitos do rubric.
