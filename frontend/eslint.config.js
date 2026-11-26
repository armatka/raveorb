// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const { createRequire } = require('node:module');
const { node: nodeGlobals } = createRequire(require.resolve('eslint-config-expo/flat'))('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Existing effects synchronize loading and filter state; keep their behavior while flagging them for review.
    rules: { 'react-hooks/set-state-in-effect': 'warn' },
  },
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@react-navigation/*'],
          message: 'Import navigation hooks from expo-router instead.',
        }],
      }],
    },
  },
  {
    files: ['tests/**/*.cjs', 'eslint.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: nodeGlobals,
    },
  },
]);
