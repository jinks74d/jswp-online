import { describe, it, expect } from "vitest";
import {
  canSendResetEmail,
  RESET_EMAIL_MIN_INTERVAL_MS,
} from "@/lib/reset-throttle";

const NOW = Date.parse("2026-08-13T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("canSendResetEmail", () => {
  it("allows the first ever request", () => {
    expect(canSendResetEmail(null, NOW)).toBe(true);
    expect(canSendResetEmail(undefined, NOW)).toBe(true);
  });

  it("blocks a second request inside the window", () => {
    // The flood case: the form was an unmetered way to mail any registered
    // address once we took delivery off Supabase.
    expect(canSendResetEmail(ago(5_000), NOW)).toBe(false);
  });

  it("allows again once the window has passed", () => {
    expect(canSendResetEmail(ago(RESET_EMAIL_MIN_INTERVAL_MS + 1), NOW)).toBe(
      true
    );
  });

  it("allows exactly at the boundary", () => {
    expect(canSendResetEmail(ago(RESET_EMAIL_MIN_INTERVAL_MS), NOW)).toBe(true);
  });

  it("fails OPEN on an unparseable timestamp", () => {
    // Being locked out of your account is worse than one extra email.
    expect(canSendResetEmail("not a date", NOW)).toBe(true);
  });

  it("allows when the stamp is somehow in the future", () => {
    // Clock skew between Postgres and the app must not wedge resets shut.
    expect(canSendResetEmail(new Date(NOW + 60_000).toISOString(), NOW)).toBe(
      true
    );
  });

  it("keeps the window short enough not to strand a real user", () => {
    // Recovery links last an hour; the wait must be a rounding error on that.
    expect(RESET_EMAIL_MIN_INTERVAL_MS).toBeLessThanOrEqual(5 * 60_000);
  });
});
