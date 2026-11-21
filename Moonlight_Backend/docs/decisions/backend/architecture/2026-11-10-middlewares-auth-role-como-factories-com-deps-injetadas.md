# ADR: Middlewares de autenticação/autorização como factories com dependências injetadas

- **Status:** Proposta
- **Data:** 2026-11-10

## Contexto
`authMiddleware` e `roleMiddleware` importavam instâncias diretamente de `config/container`.
Ao migrar para módulos, isso cria ciclo de importação (container → módulo → rotas →
middleware → container) e faz as rotas de todos os módulos dependerem do container.
Além disso, `UserService` e `RoleService` dependem um do outro (role_version).

## Decisão
- Middlewares passam a ser factories (`createAuthMiddleware`, `createRoleMiddleware`) que
  recebem apenas as funções de que precisam, e vivem no módulo `auth`.
- O contrato `Guards` (authenticate/authorize) fica em `shared/types`; as rotas dos módulos
  recebem `guards` por parâmetro e não importam o módulo `auth`.
- `user` e `role` formam um único módulo (`user`); a dependência entre módulos é
  unidirecional: `auth → user`.
- Módulos só se importam pelo `index.ts` (porta pública).

## Alternativas consideradas
1. Middlewares em `shared/middlewares` importando o container: mantém o ciclo.
2. Módulos `user` e `role` separados: ciclo entre eles, exigiria interfaces extras.
3. Rotas importando `@modules/auth` diretamente: acopla todos os módulos ao auth.

## Consequências
- (+) Sem ciclos; middlewares testáveis com dependências falsas.
- (+) Rotas dependem só de `shared`, facilitando extrair módulos como microsserviços (Order).
- (−) Todas as factories de rotas ganham um parâmetro a mais.
- (−) `user` fica maior por incorporar `role`.
