import nextVitals from 'eslint-config-next/core-web-vitals';

export default [
  ...nextVitals,
  {
    files: [
      'src/app/simulation/page.js',
      'src/app/simulation/tacticalSkillTable.js',
      'src/app/simulation/_lib/**/*.js',
      'src/app/simulation/_components/**/*.js',
      'src/utils/battleLogic.js',
      'src/utils/equipmentCatalog.js',
      'src/utils/erMeta.js',
      'src/utils/itemLogic.js',
    ],
    rules: {
      'no-undef': 'error',
      'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
      'no-shadow': 'error',
      'no-redeclare': 'error',
    },
  },
];
