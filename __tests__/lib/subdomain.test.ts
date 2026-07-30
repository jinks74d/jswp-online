import { describe, it, expect } from "vitest";
import { normalizeHost, extractSubdomainFromHost } from "@/lib/subdomain";

const BASE = "jswponline.com";

describe("normalizeHost", () => {
  it("lowercases and strips port + trailing dot", () => {
    expect(normalizeHost("LACOE.JSWPOnline.com")).toBe("lacoe.jswponline.com");
    expect(normalizeHost("jswponline.com:3000")).toBe("jswponline.com");
    expect(normalizeHost("jswponline.com.")).toBe("jswponline.com");
  });
  it("keeps IPv6 literals intact", () => {
    expect(normalizeHost("[::1]:3000")).toBe("[::1]");
  });
});

describe("extractSubdomainFromHost", () => {
  it("resolves a district subdomain", () => {
    expect(extractSubdomainFromHost("lacoe.jswponline.com", BASE)).toBe("lacoe");
    expect(extractSubdomainFromHost("LACOE.jswponline.com", BASE)).toBe("lacoe");
    expect(extractSubdomainFromHost("dallas-isd.jswponline.com", BASE)).toBe(
      "dallas-isd"
    );
  });

  it("treats apex and www as no-district", () => {
    expect(extractSubdomainFromHost("jswponline.com", BASE)).toBeNull();
    expect(extractSubdomainFromHost("www.jswponline.com", BASE)).toBeNull();
  });

  it("does NOT treat a lookalike domain as a subdomain", () => {
    // A bare host.endsWith(base) would yield "not" here and serve that
    // district's branding on a domain we don't control.
    expect(extractSubdomainFromHost("notjswponline.com", BASE)).toBeNull();
    expect(extractSubdomainFromHost("evil-jswponline.com", BASE)).toBeNull();
  });

  it("rejects multi-level hosts", () => {
    expect(extractSubdomainFromHost("a.b.jswponline.com", BASE)).toBeNull();
  });

  it("rejects labels that could never be a stored subdomain", () => {
    expect(extractSubdomainFromHost("-lacoe.jswponline.com", BASE)).toBeNull();
    expect(extractSubdomainFromHost("lacoe-.jswponline.com", BASE)).toBeNull();
    expect(
      extractSubdomainFromHost(`${"a".repeat(64)}.jswponline.com`, BASE)
    ).toBeNull();
  });

  it("accepts a 63-char label (the DNS maximum)", () => {
    const label = "a".repeat(63);
    expect(extractSubdomainFromHost(`${label}.jswponline.com`, BASE)).toBe(
      label
    );
  });

  it("maps localhost and preview hosts to the demo district", () => {
    expect(extractSubdomainFromHost("localhost:3000", BASE)).toBe("demo");
    expect(extractSubdomainFromHost("lacoe.localhost:3000", BASE)).toBe("demo");
    expect(
      extractSubdomainFromHost("jswp-online-abc123.vercel.app", BASE)
    ).toBe("demo");
  });

  it("keeps 127.0.0.1 on the apex path (deliberate dev escape hatch)", () => {
    expect(extractSubdomainFromHost("127.0.0.1:3000", BASE)).toBeNull();
  });

  it("returns null for every real host when no base domain is configured", () => {
    expect(extractSubdomainFromHost("lacoe.jswponline.com", undefined)).toBeNull();
    expect(extractSubdomainFromHost("jswponline.com", undefined)).toBeNull();
    // Dev/preview shortcuts still apply — that is how local dev works today.
    expect(extractSubdomainFromHost("localhost:3000", undefined)).toBe("demo");
  });

  it("tolerates a base domain configured with stray case or a trailing dot", () => {
    expect(extractSubdomainFromHost("lacoe.jswponline.com", "JSWPOnline.com.")).toBe(
      "lacoe"
    );
  });
});
