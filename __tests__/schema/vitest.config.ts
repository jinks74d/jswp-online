import { defineConfig } from "vite";
import path from "path";

/**
 * Vitest config for schema/RLS tests.
 * Uses the 'node' environment (no jsdom) and skips the global test-setup.ts
 * which mocks window/fetch — we need real fetch for live Supabase calls.
 *
 * fileParallelism is OFF on purpose. Every file here impersonates the same
 * seed users (alex, teacher, superAdmin) by minting a magic link and redeeming
 * it, and Supabase invalidates a user's previous unredeemed link when a new one
 * is issued. Run concurrently, whichever file redeems second loses the race and
 * dies in beforeAll with "Email link is invalid or has expired" — skipping its
 * entire suite. It alternated between files, so it read as a flaky RLS
 * regression rather than a harness problem. Serial execution removes the
 * overlap by construction; these two files are network-bound and take seconds.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["__tests__/schema/**/*.test.ts"],
    setupFiles: [],
    // See the note above — shared impersonated users, not thread safety.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../"),
    },
  },
});
