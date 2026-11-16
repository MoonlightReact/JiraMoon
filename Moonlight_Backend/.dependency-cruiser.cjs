/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Proíbe dependências circulares entre arquivos e módulos',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-module-deep-imports',
      severity: 'error',
      comment: 'Módulos só podem ser importados externamente via index.ts (barrel)',
      from: { path: '^src/modules/([^/]+)/.+' },
      to: {
        path: '^src/modules/([^/]+)/(?!index\\.ts$)',
        pathNot: '^src/modules/$1/.+',
      },
    },
    {
      name: 'shared-cannot-depend-on-modules',
      severity: 'error',
      comment: 'A camada shared não pode importar nada de modules',
      from: { path: '^src/shared/' },
      to: { path: '^src/modules/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
