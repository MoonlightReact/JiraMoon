# ADR: Regras de fronteira entre módulos verificadas automaticamente

**Status:** Aceito
**Data:** 2026-11-16

## Contexto
Após a migração para Modular Monolith, nada impedia um módulo de importar
arquivos internos de outro, nem o `shared/` de depender de `modules/`.
Só por convenção e code review, as fronteiras tendem a erodir e voltam
os ciclos de importação que já tivemos na MOON-12.

## Decisão
Impor as regras com `dependency-cruiser` (`npm run arch:check`):
1. `no-circular`: nenhum ciclo de importação.
2. `no-module-deep-imports`: módulos só se comunicam pelo `index.ts` (barrel).
3. `shared-cannot-depend-on-modules`: `shared/` não importa de `modules/`.
4. `no-module-deep-imports-from-outside`: no dependency-cruiser exclui explicitamente `src/config/container.ts`.
O check roda no hook `pre-push` do Husky e falha o push em caso de violação.

## Alternativas consideradas
- Apenas convenção + code review: não escala e não deixa evidência.

## Consequências
- (+) Violações arquiteturais são pegas antes de chegar ao remoto.
- (+) A regra do barrel prepara a extração futura de módulos para serviços.
- (+) O `src/config/container.ts` (composition root) é a **única exceção**
  à regra do barrel: pode importar classes concretas dos módulos para
  montar o grafo de dependências. Todo o restante do código só importa
  via `index.ts`. Isso mantém os barrels enxutos (rotas e contratos)
  sem impedir a composição da aplicação.
- (−) Todo import entre módulos precisa passar pelo `index.ts`,
  o que exige manter os barrels atualizados.
- (−) Mais uma etapa no pre-push.
