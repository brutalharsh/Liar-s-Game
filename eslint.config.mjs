// @ts-check
// Root flat ESLint config — covers all workspaces (packages/*, apps/*).
// Type-aware rules use the TS project service, so each workspace needs a tsconfig.
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'node:url';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.next/**',
      '**/out/**',
      '**/*.d.ts',
      'STR/**',
      'research/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    rules: {
      // Per AGENTS.md mission F1: typescript-eslint strict + no floating promises.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  // Plain JS (config/tooling scripts) runs without type information.
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  // Config files and one-off scripts are not covered by any tsconfig.
  {
    files: ['**/*.config.{js,cjs,mjs,ts}', '**/scripts/**/*.mjs', '**/scripts/**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
