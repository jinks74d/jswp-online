import { describe, it, expect } from "vitest";
import { safeNext, buildConfirmUrl, isAuthLinkType } from "@/lib/auth-links";

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

describe("buildConfirmUrl", () => {
  it("points at our own handler, never Supabase's verify endpoint", () => {
    // The whole bug: action_link goes to /auth/v1/verify, which answers with
    // tokens in a hash fragment the server cannot read.
    const url = buildConfirmUrl({
      siteUrl: "https://demo.jswponline.com",
      hashedToken: "abc123",
      type: "recovery",
      next: "/reset-password?recovery=1",
    });
    const u = new URL(url);
    expect(u.origin).toBe("https://demo.jswponline.com");
    expect(u.pathname).toBe("/auth/confirm");
    expect(u.searchParams.get("token_hash")).toBe("abc123");
    expect(u.searchParams.get("type")).toBe("recovery");
    expect(u.searchParams.get("next")).toBe("/reset-password?recovery=1");
  });

  it("encodes a next containing its own query string", () => {
    const url = buildConfirmUrl({
      siteUrl: "https://x.test",
      hashedToken: "t",
      type: "recovery",
      next: "/reset-password?recovery=1",
    });
    // The nested ? must survive round-tripping, not truncate the param.
    expect(new URL(url).searchParams.get("next")).toBe(
      "/reset-password?recovery=1"
    );
  });
});

describe("isAuthLinkType", () => {
  it("accepts the types we mint", () => {
    expect(isAuthLinkType("recovery")).toBe(true);
    expect(isAuthLinkType("invite")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isAuthLinkType("magiclink_but_not_really")).toBe(false);
    expect(isAuthLinkType(null)).toBe(false);
    expect(isAuthLinkType("")).toBe(false);
  });
});
