import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * apps/web test entry — store + logic unit tests (node env; no React
 * render tests needed per the W2 mission). The root vitest workspace
 * glob picks this file up automatically.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
