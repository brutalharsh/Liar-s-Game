import { defineConfig } from 'vitest/config';

/**
 * Root test entry: runs every workspace that ships a vitest config.
 * `npm test` at the root runs each workspace's own `test` script instead;
 * this file serves `npx vitest` from the repo root (all workspaces at once).
 */
export default defineConfig({
  test: {
    projects: ['packages/*/vitest.config.{ts,mts}', 'apps/*/vitest.config.{ts,mts}'],
  },
});
