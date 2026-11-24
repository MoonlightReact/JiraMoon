# ADR: Validação de IDs, page e limit + limpeza de código morto no módulo game

## Status
Aceito

## Contexto
As rotas que recebem parâmetros numéricos (ids, page e limit) não faziam validação consistente.  
Valores inválidos como `"1.5"`, `"-5"`, `"1e3"`, `"abc"`, `""` ou `"0"` podiam chegar aos services (muitas vezes como `0`), gerando comportamento indesejado.  

Além disso, existia código morto no módulo `game` (imports e variáveis não utilizados, e condicionais desnecessárias).

## Decisão
- Criar a função `toPositiveInt` em `shared/query/queryParser.ts`:
  - Aceita apenas inteiros positivos (ex.: `"7"`).
  - Recusa: `"1.5"`, `"-5"`, `"1e3"`, `"abc"`, `""` e `"0"`.
- Passar a usar `toPositiveInt` para os ids de:
  - game
  - category
  - user
  - role
  - order
- Em caso de id inválido:
  - `role` (PATCH `/roles/user/:id`) e `order` (GET `/orders/:id` e `can-user-purchase`) passam a responder **400** em vez de enviar `0` para o service.
- Definir teto de `limit` = `50` (`MAX_LIMIT`).  
  Valores maiores (ex.: `limit=1000000000`) são reduzidos para 50.
- `page` e `limit` inválidos voltam aos valores padrão.
- Limpeza no módulo game:
  - `updateGame`: removidos `pool`, `ResultSetHeader` e o `SET @usuario_logado` (auditoria de preço será feita via código).
  - `game.controller`: removidos os 3 `if (!games)` mortos.
  - `toInt` removido (sem outros usos).

## Consequências

### Positivas
- Validação centralizada e previsível de parâmetros numéricos.
- Proteção contra ids inválidos chegando aos services.
- Controle de carga com teto de `limit = 50`.
- Código mais limpo no módulo game.

### Negativas / Pendências
- `role.controller` e `order.controller` ainda possuem `if (!roles)` e `if (!orders)` mortos (fora do escopo desta mudança).

## Testes
- Um teste por caso do `toPositiveInt`, mais `toPage`, `toLimit` e `parseGameQuery` (incluindo o teto de 50).
- `npm test`: 20 suítes, 235 testes passando (com MySQL e Redis no ar).
- `arch:check`: sem violações.
