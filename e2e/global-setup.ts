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

export default async function globalSetup(): Promise<void> {
  const fixtures = await loadWritingFixtures();
  writeWritingFixtures(fixtures);

  const summary = fixtures
    .map((f) => `${f.mode}(${f.slugs.length} steps)`)
    .join(", ");
  console.log(
    `[e2e] discovered ${fixtures.length} writing fixture(s): ${summary || "none"}`
  );
}
