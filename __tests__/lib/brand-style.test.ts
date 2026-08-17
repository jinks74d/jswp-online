/**
 * Tests for lib/brand-style.ts — the school → district → fallback precedence
 * that decides what colour a whole surface renders in.
 *
 * The subtle case is the empty return. Emitting a hardcoded default when
 * nothing resolves would PIN the subtree to that colour and override the
 * district branding :root already carries, so "no opinion" has to mean "set
 * no custom properties at all".
 */

import { describe, it, expect } from "vitest";
import { brandStyle, ADMIN_SHELL_DEFAULT_BRAND } from "@/lib/brand-style";

const SCHOOL = "#7c3aed"; // violet
const DISTRICT = "#1e3a8a"; // deep blue

/** Read a CSS custom property off the returned style object. */
function v(style: React.CSSProperties, name: string): string | undefined {
  return (style as unknown as Record<string, string>)[name];
}

describe("brandStyle — precedence", () => {
  it("prefers the school colour over the district's", () => {
    expect(v(brandStyle(SCHOOL, DISTRICT), "--brand")).toBe(SCHOOL);
  });

  it("falls back to the district colour when the school has none", () => {
    expect(v(brandStyle(null, DISTRICT), "--brand")).toBe(DISTRICT);
    expect(v(brandStyle(undefined, DISTRICT), "--brand")).toBe(DISTRICT);
    expect(v(brandStyle("", DISTRICT), "--brand")).toBe(DISTRICT);
  });

  it("falls back to the district colour when the school colour is malformed", () => {
    for (const bad of ["violet", "#GGGGGG", "#7c3ae", "rgb(1,2,3)"]) {
      expect(v(brandStyle(bad, DISTRICT), "--brand")).toBe(DISTRICT);
    }
  });

  it("uses the caller's fallback only when neither resolves", () => {
    expect(v(brandStyle(null, null, ADMIN_SHELL_DEFAULT_BRAND), "--brand")).toBe(
      ADMIN_SHELL_DEFAULT_BRAND
    );
    // …and never in preference to a real colour.
    expect(v(brandStyle(null, DISTRICT, ADMIN_SHELL_DEFAULT_BRAND), "--brand")).toBe(
      DISTRICT
    );
  });
});

describe("brandStyle — the empty case", () => {
  it("returns {} when nothing resolves and no fallback is given", () => {
    // Critical: an empty object sets no custom properties, so the :root
    // definition in globals.css stays in charge. Returning a colour here
    // would override the district branding the middleware resolved.
    expect(brandStyle(null, null)).toEqual({});
    expect(brandStyle(undefined, undefined)).toEqual({});
  });

  it("returns {} when every candidate including the fallback is malformed", () => {
    expect(brandStyle("nope", "also-nope", "still-nope")).toEqual({});
  });
});

describe("brandStyle — emitted variables", () => {
  it("emits the whole --brand family globals.css and /school expect", () => {
    const style = brandStyle(SCHOOL, DISTRICT);
    for (const name of [
      "--brand",
      "--brand-contrast",
      "--brand-rgb",
      "--brand-soft",
      "--brand-soft-strong",
    ]) {
      expect(style, name).toHaveProperty(name);
    }
  });

  it('emits --brand-rgb as a bare "r, g, b" tuple', () => {
    // rgba(var(--brand-rgb), …) in globals.css depends on this shape.
    expect(v(brandStyle("#1e3a8a", null), "--brand-rgb")).toBe("30, 58, 138");
  });

  it("builds the soft tints from that same tuple", () => {
    const style = brandStyle("#1e3a8a", null);
    expect(v(style, "--brand-soft")).toBe("rgba(30, 58, 138, 0.1)");
    expect(v(style, "--brand-soft-strong")).toBe("rgba(30, 58, 138, 0.18)");
  });

  it("emits a readable contrast colour for both dark and light brands", () => {
    // White text on a dark brand, dark text on a light one — the accessibility
    // reason --brand-contrast exists at all.
    expect(v(brandStyle("#000000", null), "--brand-contrast")).toMatch(
      /^#(f{6}|F{6})$/
    );
    const onLight = v(brandStyle("#ffffff", null), "--brand-contrast");
    expect(onLight).not.toMatch(/^#(f{6}|F{6})$/);
  });

  it("never leaks 'undefined' into a tint when given a valid hex", () => {
    for (const hex of ["#000000", "#ffffff", "#7c3aed", "#e11d48"]) {
      const style = brandStyle(hex, null);
      expect(v(style, "--brand-soft")).not.toContain("undefined");
      expect(v(style, "--brand-rgb")).not.toContain("undefined");
    }
  });
});
