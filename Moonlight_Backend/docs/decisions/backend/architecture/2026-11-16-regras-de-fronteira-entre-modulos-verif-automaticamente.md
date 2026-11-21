# ADR: Regras de fronteira entre módulos verificadas automaticamente

**Status:** Aceito
**Data:** 2026-11-16

## Contexto

Após a migração para Modular Monolith, nada impedia um módulo de importar
arquivos internos de outro, nem o `shared/` de depender de `modules/`.
Só por convenção e code review, as fronteiras tendem a erodir e voltam
os ciclos de importação que já tivemos na MOON-12.

A primeira versão das regras só avaliava arquivos de dentro de `src/modules/`.
Ao importar `category.routes.js` direto no `server.ts`, o `arch:check`
continuou passando: arquivos fora dos módulos não eram verificados.

## Decisão

Impor as regras com `dependency-cruiser` (`npm run arch:check`):

1. `no-circular`: nenhum ciclo de importação.
2. `no-module-deep-imports`: um módulo só importa outro módulo pelo `index.ts` (barrel).
3. `no-module-deep-imports-from-outside`: arquivos fora de `src/modules/`
   (como o `server.ts`) também só importam módulos pelo `index.ts`.
4. `shared-cannot-depend-on-modules`: `shared/` não importa de `modules/`.

Os barrels exportam apenas o que é público: factories de rotas
(`create<Modulo>Routes`) e contratos entre módulos (`export type`).
Repositories, services e controllers não entram no barrel.

**Exceção:** `src/config/container.ts` (composition root) pode importar classes
concretas direto dos arquivos dos módulos, porque sua função é montar o grafo
de dependências. A regra 3 exclui esse arquivo (`pathNot`). Todo o resto
do código só importa via `index.ts`.

O hook `pre-push` do Husky roda `npm run arch:check` e, em seguida,
`npm test`. Cada comando tem a própria checagem de saída, e a falha de
qualquer um bloqueia o push.

## Alternativas consideradas

- Apenas convenção + code review: não escala e não deixa evidência.
- Exportar tudo pelo barrel, inclusive classes concretas, sem exceção para o
  container: mantém a regra uniforme, mas alarga a superfície pública de cada
  módulo e expõe detalhes de implementação a quem está fora.

## Consequências

- (+) Violações arquiteturais são pegas antes de chegar ao remoto.
- (+) A regra do barrel prepara a extração futura de módulos para serviços.
- (+) Os barrels ficam enxutos e passam a descrever a API pública do módulo.
- (+) O `container.ts` é a única exceção, e ela é explícita na configuração
  do `dependency-cruiser`, não um buraco na regra.
- (−) Todo import entre módulos precisa passar pelo `index.ts`,
  o que exige manter os barrels atualizados com o que é realmente público.
- (−) O `container.ts` conhece os caminhos internos dos arquivos; mover um
  arquivo de módulo exige ajustar seus imports.
- (−) O `auth` depende dos tipos concretos `UserRepository` e `UserRoleRepository`
  do módulo `user` (expostos como `export type` no barrel). Uma melhoria futura
  é o `auth` declarar portas próprias e receber a implementação por injeção.
- (−) Mais uma etapa no pre-push.
