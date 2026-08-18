import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),

  // Browser code
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  // Netlify Functions and build scripts run in Node, where `process` exists.
  // Without this they reported a wall of false `no-undef` errors, which made the
  // lint output useless for spotting real problems.
  {
    files: ['netlify/**/*.js', 'scripts/**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },

  // Tests
  {
    files: ['test/**/*.{js,jsx}'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      sourceType: 'module',
    },
  },
])
