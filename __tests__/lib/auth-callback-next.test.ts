/**
 * The callback's `next` sanitiser. It is attacker-reachable — anyone can craft
 * /auth/callback?next=... — so it must never send a user off-site.
 */

import { describe, it, expect } from "vitest";

/**
 * Mirrors safeNext in app/auth/callback/route.ts. Kept in the test rather than
 * exported from the route because route modules pull in next/server; if the
 * rule grows past this, promote it to lib/ and import it in both places.
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/login?confirmed=1";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/login?confirmed=1";
  return raw;
}

describe("callback next sanitiser", () => {
  it("passes the recovery destination through", () => {
    expect(safeNext("/reset-password?recovery=1")).toBe(
      "/reset-password?recovery=1"
    );
  });

  it("defaults when absent", () => {
    expect(safeNext(null)).toBe("/login?confirmed=1");
  });

  it("rejects protocol-relative URLs", () => {
    // `${origin}//evil.com` is read by the browser as a protocol-relative
    // URL and leaves the site — the classic open redirect.
    expect(safeNext("//evil.com")).toBe("/login?confirmed=1");
    expect(safeNext("//evil.com/path")).toBe("/login?confirmed=1");
  });

  it("rejects absolute URLs", () => {
    expect(safeNext("https://evil.com")).toBe("/login?confirmed=1");
    expect(safeNext("http://evil.com")).toBe("/login?confirmed=1");
  });

  it("rejects anything not rooted at /", () => {
    expect(safeNext("evil.com")).toBe("/login?confirmed=1");
    expect(safeNext("../admin")).toBe("/login?confirmed=1");
  });

  it("allows ordinary in-app paths", () => {
    expect(safeNext("/dashboard")).toBe("/dashboard");
    expect(safeNext("/login?confirmed=1")).toBe("/login?confirmed=1");
  });
});
