// Shared ESLint flat config for the whole monorepo.
import eslint from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['**/dist/', '**/build/', '**/coverage/', '**/.vite/']),

  eslint.configs.recommended,

  // Type-aware TypeScript rules for every TS file in the repo.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Plain JS files (root configs) aren't in any tsconfig.
  {
    files: ['**/*.{js,cjs,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  // Node code.
  {
    files: ['apps/api/**/*.ts', 'packages/shared/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // React web app.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [eslintReact.configs['recommended-type-checked'], reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
    rules: {
      // Covered by the official react-hooks plugin; avoid duplicate reports.
      '@eslint-react/rules-of-hooks': 'off',
    },
  },

  // Import ordering everywhere.
  {
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },

  // Must stay last: turns off rules that fight Prettier.
  prettier,
);
