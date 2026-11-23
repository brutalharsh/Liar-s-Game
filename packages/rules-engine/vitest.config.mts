import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Soak runs ~56-59s under load vs the previous 60s cap — zero headroom.
    testTimeout: 120000,
    hookTimeout: 120000,
  },
});
