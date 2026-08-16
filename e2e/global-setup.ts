/**
 * Discovers the writings the step sweep walks, BEFORE Playwright collects any
 * spec file.
 *
 * Ordering is the whole reason this is a globalSetup rather than another
 * project in the `setup` phase. student-steps.spec.ts generates one test per
 * step by reading the fixture list at module scope, and Playwright loads every
 * spec to build the suite before it runs a single project — so a fixture file
 * written by a setup PROJECT would always be one run late, and a fresh
 * checkout would report zero step tests while exiting green.
 *
 * Authentication stays a setup project: it needs a browser, and its output
 * (storageState) is consumed at test RUN time, not collection time.
 */

import { loadWritingFixtures, writeWritingFixtures } from "./fixtures/writings";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * The suite does not start its own server — see the note in
 * playwright.config.ts. Check up front so a forgotten server reads as one
 * actionable line instead of 48 connection refusals.
 */
async function assertServerUp(): Promise<void> {
  try {
    const res = await fetch(`${BASE_URL}/login`, { redirect: "manual" });
    if (res.status >= 500) {
      throw new Error(`responded ${res.status}`);
    }
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    throw new Error(
      `No app server at ${BASE_URL} (${why}).\n\n` +
        `Start one first — it is deliberately not managed by Playwright:\n` +
        `    npm run e2e:build     # once, after any code change\n` +
        `    npm run e2e:serve     # leave running\n` +
        `    npm run test:e2e\n`
    );
  }
}

export default async function globalSetup(): Promise<void> {
  await assertServerUp();

  const fixtures = await loadWritingFixtures();
  writeWritingFixtures(fixtures);

  const summary = fixtures
    .map((f) => `${f.mode}(${f.slugs.length} steps)`)
    .join(", ");
  console.log(
    `[e2e] discovered ${fixtures.length} writing fixture(s): ${summary || "none"}`
  );
}
