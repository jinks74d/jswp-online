import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

/**
 * Smoke E2E. Deliberately narrow: this suite is not here to prove the writing
 * pedagogy is correct — the unit and RLS suites do that — it is here to catch
 * the one class of failure they structurally cannot see.
 *
 * 109 server actions live behind a "use server" boundary and 64 step
 * components sit at 4% unit coverage. A refactor that breaks the step router,
 * an auth gate, or a whole step's render type-checks cleanly and passes 520
 * unit tests. Only a real browser hitting a real route notices.
 *
 * Runs against `next dev` on port 3100 so it never collides with a dev server
 * the user already has on 3000, and never triggers the `next build` that
 * corrupts .next while dev is running.
 *
 * Serial by default. The seeded fixtures (alex@demo.test and the demo
 * writings) are shared mutable state, and this suite navigates step routes
 * that lazily bootstrap rows — parallel workers would race each other for the
 * same writing, exactly the way the RLS suite had to go serial.
 */

loadEnv({ path: ".env.local" });

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Must run before spec collection — student-steps.spec.ts builds its test
  // list from the fixtures this writes. See e2e/global-setup.ts.
  globalSetup: "./e2e/global-setup.ts",
  // Shared seed data — see the note above.
  workers: 1,
  fullyParallel: false,
  // A flake here means a real race worth reading, not a retry to paper over.
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    // Logs in through the real form once and banks the session, so the specs
    // below do not each pay for an auth round-trip.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // Cold Next.js dev compiles are slow, and the first request to each route
    // compiles it on demand.
    timeout: 180_000,
    // Next.js logs its own build errors to stdout, so piping BOTH is what
    // makes a 500 legible. With stdout ignored, a webpack worker crash
    // surfaced only as "HTTP 500" with no cause anywhere in the report.
    stdout: "pipe",
    stderr: "pipe",
    // Without this, Playwright kills the server ungracefully on Windows and
    // the runner then hangs at teardown — every test finishes, no summary is
    // ever printed, and the process never exits.
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
  },
});
