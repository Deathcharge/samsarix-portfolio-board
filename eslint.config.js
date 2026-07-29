import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'

const nodeGlobals = {
  AbortSignal: 'readonly',
  Buffer: 'readonly',
  URL: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  globalThis: 'readonly',
  process: 'readonly',
  setTimeout: 'readonly',
}

const browserGlobals = {
  AbortController: 'readonly',
  Intl: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  navigator: 'readonly',
  window: 'readonly',
}

export default [
  {
    ignores: ['client/dist/**', 'coverage/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['server/**/*.js', 'test/**/*.js', 'eslint.config.js', 'vite.config.js'],
    languageOptions: {
      globals: nodeGlobals,
    },
  },
  {
    files: ['client/src/**/*.{js,jsx}'],
    languageOptions: {
      globals: browserGlobals,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
]
