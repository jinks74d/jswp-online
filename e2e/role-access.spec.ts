/**
 * Role gates, exercised through the browser.
 *
 * The RLS suite proves the DATABASE refuses cross-role reads. This proves the
 * ROUTES do too. They are different failures: a page that fetches with the
 * service role, or a layout that forgets requireRole, leaks a whole surface
 * while every RLS test still passes. CLAUDE.md section 14.5 lists exactly that
 * as a legacy-app mistake worth not repeating.
 *
 * Kept to redirect behaviour on purpose — no data assertions, so this stays
 * fast and does not go red every time copy changes.
 */

import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "./fixtures/accounts";

/** Signed out, every protected area must send you to login. */
test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const path of ["/student", "/dashboard", "/admin", "/school", "/district"]) {
    test(`${path} redirects to login`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test("the login page itself is reachable", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Email Address")).toBeVisible();
  });
});

test.describe("as a student", () => {
  test.use({ storageState: STORAGE_STATE.student });

  test("reaches their own portal", async ({ page }) => {
    await page.goto("/student", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/student/);
  });

  for (const path of ["/dashboard", "/admin", "/school", "/district"]) {
    test(`is kept out of ${path}`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      // Any non-entry outcome is acceptable — forbidden page, bounce home, or
      // back to their own portal. What must NOT happen is rendering it.
      await expect(page).not.toHaveURL(new RegExp(`${path}(/|$)`));
    });
  }
});

test.describe("as a teacher", () => {
  test.use({ storageState: STORAGE_STATE.teacher });

  test("reaches the dashboard", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("is kept out of the student portal", async ({ page }) => {
    await page.goto("/student", { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/student(\/|$)/);
  });

  test("is kept out of super-admin", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/admin(\/|$)/);
  });
});
