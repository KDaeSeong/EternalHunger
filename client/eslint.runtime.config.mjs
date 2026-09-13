import nextVitals from 'eslint-config-next/core-web-vitals';

const runtimeConfig = [
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
      'src/utils/statusEffectApplication.js',
      'src/utils/simulationRandom.js',
    ],
    rules: {
      'no-undef': 'error',
      'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
      'no-shadow': 'error',
      'no-redeclare': 'error',
    },
  },
];

export default runtimeConfig;
