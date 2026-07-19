// client/.eslintrc.js — aucune config eslint n'existait avant ce fix
// (ni .eslintrc.*, ni champ eslintConfig) : `npm run lint` échouait
// systématiquement en CI ("ESLint couldn't find a configuration file").
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
    // Vitest (vitest.config.js: globals: true) expose describe/test/expect/
    // beforeEach... avec la même API que Jest — env jest suffit pour ceux-ci.
    jest: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: 'detect' },
  },
  plugins: ['react-refresh'],
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'dist/',
    'build/',
    'coverage/',
    // Doublon mort de emailService.js (jamais importé nulle part, vérifié
    // par grep), export cassé (nom de fonction manquant) — pré-existant.
    'lib/services/mailService.js',
  ],
  rules: {
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    // Application entièrement en français : les apostrophes ("l'agence",
    // "d'accord"...) sont partout dans le texte JSX. Règle purement
    // cosmétique (échappement HTML), aucun impact fonctionnel — désactivée
    // plutôt que d'échapper des centaines d'occurrences pré-existantes.
    'react/no-unescaped-entities': 'off',
    // Property.js (server) a le même souci d'espaces NBSP historiques ;
    // ici un fichier de test en hérite via une chaîne copiée-collée.
    // Règle purement stylistique, aucun impact fonctionnel.
    'no-irregular-whitespace': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
  overrides: [
    {
      // Vitest (globals: true dans vitest.config.js) + mocks de composants
      // anonymes (framer-motion, etc.) — pattern standard dans les tests.
      files: ['lib/__tests__/**/*.{js,jsx}'],
      globals: { vi: 'readonly' },
      rules: { 'react/display-name': 'off' },
    },
  ],
};
