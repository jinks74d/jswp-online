import { defineConfig } from "vite";
import path from "path";

/**
 * Vitest config for schema/RLS tests.
 * Uses the 'node' environment (no jsdom) and skips the global test-setup.ts
 * which mocks window/fetch — we need real fetch for live Supabase calls.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["__tests__/schema/**/*.test.ts"],
    setupFiles: [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../"),
    },
  },
});
