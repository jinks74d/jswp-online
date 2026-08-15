/**
 * Signs in through the real login form once per role and banks the session, so
 * the specs do not each pay for an auth round-trip.
 *
 * Deliberately drives the actual form rather than minting a Supabase session
 * directly. Logging in IS one of the paths worth smoke-testing, and a token
 * injected past the form would not exercise the cookie handling in
 * lib/supabase/middleware.ts — which is where auth has actually broken before.
 */

import { test as setup, expect } from "@playwright/test";
import { STORAGE_STATE, CREDENTIALS } from "./fixtures/accounts";

setup("authenticate as student", async ({ page }) => {
  const { email, password } = CREDENTIALS.student;

  await page.goto("/login");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // getRedirectPath sends students to /student. Landing back on /login means
  // the seeded password drifted — fail here with that said plainly rather
  // than letting every downstream spec fail on a mystery redirect.
  await page.waitForURL(/\/student(\/|$)/, { timeout: 30_000 }).catch(() => {
    throw new Error(
      `Student login did not reach /student. Landed on ${page.url()}. ` +
        `Re-run "npm run seed:auth" if the seeded password has drifted.`
    );
  });

  await expect(page).toHaveURL(/\/student/);
  await page.context().storageState({ path: STORAGE_STATE.student });
});

setup("authenticate as teacher", async ({ page }) => {
  const { email, password } = CREDENTIALS.teacher;

  await page.goto("/login");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 30_000 }).catch(() => {
    throw new Error(
      `Teacher login did not reach /dashboard. Landed on ${page.url()}. ` +
        `Re-run "npm run seed:auth" if the seeded password has drifted.`
    );
  });

  await expect(page).toHaveURL(/\/dashboard/);
  await page.context().storageState({ path: STORAGE_STATE.teacher });
});
