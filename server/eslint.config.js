// server/eslint.config.js — flat config requis par ESLint 9 (npm run lint).
// Aucun eslint.config.* n'existait avant ce fix : `npm run lint` échouait
// systématiquement en CI ("ESLint couldn't find an eslint.config file").
const js = require('@eslint/js');
const globals = require('globals');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      // server/models/Property.js utilise des NBSP (U+00A0) en indentation
      // depuis toujours (encodage historique, hors périmètre à corriger ici) —
      // règle purement stylistique, ne masque aucun bug fonctionnel.
      'no-irregular-whitespace': 'off',
      // Pattern volontaire et répété dans le codebase (ex: zohoImapService.js)
      // pour ignorer une erreur secondaire lors d'un close() de nettoyage.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  prettierConfig,
  {
    // Fichiers morts, jamais require()-és nulle part dans le codebase (vérifié
    // par grep) — syntaxe ESM ou cassée, pré-existants à ce Sprint. Les
    // exclure du lint plutôt que de les "réparer" hors périmètre ; ils ne
    // s'exécutent jamais et ne présentent donc aucun risque fonctionnel.
    ignores: [
      'node_modules/',
      'coverage/',
      'routes/projectRoutes.js',
      'routes/unreadCountService.js',
      'templates/quoteNotificationTemplate.js',
      'utils/upload.js',
      'utils/generateToken.js',
      // Doublon mort de config/db.js (le vrai connecteur DB utilisé partout,
      // cf. require('./config/db') dans server.js et les tests).
      'config.js',
    ],
  },
];
