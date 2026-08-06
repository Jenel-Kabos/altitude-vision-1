module.exports = {
  root: true,
  extends: ['expo'],
  plugins: ['promise'],
  env: {
    jest: true,
  },
  globals: {
    __DEV__: 'readonly',
    atob: 'readonly',
    clearInterval: 'readonly',
    clearTimeout: 'readonly',
    Intl: 'readonly',
    setInterval: 'readonly',
    setTimeout: 'readonly',
    URLSearchParams: 'readonly',
  },
  ignorePatterns: ['android/', 'ios/', 'dist/', 'node_modules/'],
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    // React Compiler diagnostics are advisory for this migration. Enabling them
    // as errors would require functional rewrites outside TECH-EXPO-1.
    'react-hooks/immutability': 'off',
    'react-hooks/preserve-manual-memoization': 'off',
    'react-hooks/refs': 'off',
    'react-hooks/set-state-in-effect': 'off',
    'promise/catch-or-return': 'warn',
  },
};
