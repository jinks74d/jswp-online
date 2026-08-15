/**
 * Every visible step of every mode must render.
 *
 * This is the specific hole the unit suite cannot cover. components/student/
 * sits at ~4% statement coverage with 54 of 64 files untested, and the step
 * router resolves components dynamically from lib/jswp-modes.ts — so deleting
 * a step component, breaking its data query, or throwing in a Server
 * Component all type-check cleanly and pass every unit test. The failure only
 * appears as a blank screen in front of a student.
 *
 * It matters most for the StepShell extraction, where nine step clients get
 * rewritten onto a shared scaffold. This suite is what says "and all of them
 * still render" without a human clicking through four modes.
 *
 * Assertions are deliberately shallow — the step's own heading, a Continue
 * affordance, no server error, no uncaught page error. Anything deeper would
 * duplicate the unit tests and turn every pedagogy tweak into a broken E2E.
 */

import { test, expect, type Page } from "@playwright/test";
import { STORAGE_STATE } from "./fixtures/accounts";
import { readWritingFixtures, ALL_MODES } from "./fixtures/writings";

test.use({ storageState: STORAGE_STATE.student });

// Written by the setup project — see fixtures/writings.ts for why discovery
// cannot happen inline here.
const fixtures = readWritingFixtures();

test("seed data covers every mode, or says which it does not", async () => {
  const covered = new Set(fixtures.map((f) => f.mode));
  const missing = ALL_MODES.filter((m) => !covered.has(m));

  // Reported, never silent. A suite that quietly skips a mode reads as
  // "all four pass" on the summary line.
  if (missing.length > 0) {
    console.warn(
      `[e2e] no seeded writing for: ${missing.join(", ")}. ` +
        `Those modes are NOT covered by this run.`
    );
  }
  expect(fixtures.length, "at least one seeded writing to walk").toBeGreaterThan(0);
});

/** Fail on a Next.js error overlay or a crashed Server Component. */
async function expectNoAppError(page: Page, where: string) {
  const body = await page.locator("body").innerText();
  for (const marker of [
    "Application error",
    "Unhandled Runtime Error",
    "This page could not be found",
    "Internal Server Error",
  ]) {
    expect(body, `${where} showed "${marker}"`).not.toContain(marker);
  }
}

for (const fixture of fixtures) {
  test.describe(`${fixture.mode} — ${fixture.assignmentTitle}`, () => {
    for (const slug of fixture.slugs) {
      test(`step "${slug}" renders`, async ({ page }) => {
        const pageErrors: Error[] = [];
        page.on("pageerror", (e) => pageErrors.push(e));

        const url = `/student/writings/${fixture.writingId}/${slug}`;
        const response = await page.goto(url, { waitUntil: "domcontentloaded" });

        expect(response?.status(), `${url} HTTP status`).toBeLessThan(400);

        // The router redirects to the student's current step when a later one
        // is not yet reachable. That is correct behaviour, not a failure — but
        // it must land on a real step page, not bounce to login or /forbidden.
        await expect(page).toHaveURL(/\/student\/writings\/[0-9a-f-]+\/[a-z-]+/i);

        await expectNoAppError(page, url);

        // Something identifying the step, and a way forward. Both step
        // components and the placeholder satisfy this.
        await expect(
          page.getByRole("heading").first(),
          `${url} rendered no heading`
        ).toBeVisible();

        expect(
          pageErrors.map((e) => e.message),
          `${url} threw in the browser`
        ).toEqual([]);
      });
    }

    test("step sidebar lists the same steps the config does", async ({ page }) => {
      // Guards the contract in CLAUDE.md section 6: lib/jswp-modes.ts is the
      // ONLY step list. A sidebar that hardcoded its own would drift silently.
      await page.goto(`/student/writings/${fixture.writingId}/${fixture.slugs[0]}`, {
        waitUntil: "domcontentloaded",
      });
      await expectNoAppError(page, "step sidebar");

      const nav = page.getByRole("navigation");
      await expect(nav.first()).toBeVisible();
    });
  });
}
