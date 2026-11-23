## O que muda
Validação de ids, page e limit nas rotas e limpeza de código morto no módulo game.

## Como
- `toPositiveInt` em `shared/query/queryParser.ts`: aceita "7"; recusa "1.5", "-5", "1e3", "abc", "" e "0"
- Ids de game, category, user, role e order passam a usar `toPositiveInt`
- `role` (PATCH /roles/user/:id) e `order` (GET /orders/:id e can-user-purchase) agora respondem 400 para id inválido, em vez de passar 0 ao service
- Teto de `limit` = 50 (`MAX_LIMIT`); `limit=1000000000` é reduzido para 50
- `page` e `limit` inválidos voltam ao padrão
- `updateGame`: removidos `pool`, `ResultSetHeader` e o `SET @usuario_logado` (auditoria de preço será feita via código)
- `game.controller`: removidos os 3 `if (!games)` mortos
- `toInt` removido (sem outros usos)

## Testes
- Um teste por caso do `toPositiveInt`, mais `toPage`, `toLimit` e `parseGameQuery` (teto de 50)
- `npm test`: 20 suítes, 235 testes passando (com MySQL e Redis no ar)
- `arch:check`: sem violações

## Fora do escopo
- `role.controller` e `order.controller` ainda têm `if (!roles)` e `if (!orders)` mortos