/**
 * Contract between app/globals.css and the branding emitter.
 *
 * globals.css derives the app-wide --brand accent from the district vars that
 * brandingToCssVars() injects inline on <html>:
 *
 *   --brand:          var(--district-primary, …)
 *   --brand-contrast: var(--district-primary-contrast, …)
 *   --brand-rgb:      var(--district-primary-rgb, …)
 *
 * Nothing links those two files, so dropping or renaming an emitted var would
 * not fail a build — every branded surface would just quietly fall back to the
 * default blue. These tests fail instead.
 *
 * The --*-rgb format matters as much as its presence: --brand-soft is built
 * with rgba(var(--brand-rgb), 0.1), which is only valid CSS if the var holds a
 * bare "r, g, b" tuple. Wrapping it as "rgb(...)" would make every soft tint
 * in the app resolve to nothing.
 */

import { describe, it, expect } from "vitest";
import { brandingToCssVars } from "@/lib/branding-headers";
import type { DistrictBranding } from "@/lib/district-branding.types";

function branding(over: Partial<DistrictBranding> = {}): DistrictBranding {
  return {
    id: "d1",
    name: "Demo District",
    logo_url: null,
    primary_color: "#1e3a8a",
    secondary_color: "#b91c1c",
    ...over,
  };
}

/** The vars globals.css reads. Keep in step with the :root block there. */
const REQUIRED_BY_CSS = [
  "--district-primary",
  "--district-primary-contrast",
  "--district-primary-rgb",
] as const;

describe("branding CSS var contract", () => {
  it("emits every var globals.css derives --brand from", () => {
    const vars = brandingToCssVars(branding()) as Record<string, string>;
    for (const name of REQUIRED_BY_CSS) {
      expect(vars, `globals.css reads ${name}`).toHaveProperty(name);
      expect(String(vars[name]).trim()).not.toBe("");
    }
  });

  it("passes the chosen primary through verbatim", () => {
    const vars = brandingToCssVars(
      branding({ primary_color: "#7c3aed" })
    ) as Record<string, string>;
    expect(vars["--district-primary"]).toBe("#7c3aed");
  });

  it('emits --district-primary-rgb as a bare "r, g, b" tuple', () => {
    // rgba(var(--brand-rgb), 0.1) in globals.css depends on this exact shape.
    const vars = brandingToCssVars(
      branding({ primary_color: "#1e3a8a" })
    ) as Record<string, string>;
    expect(vars["--district-primary-rgb"]).toBe("30, 58, 138");
    expect(vars["--district-primary-rgb"]).not.toMatch(/rgba?\(/);
  });

  it("emits a contrast colour, not the primary again", () => {
    const vars = brandingToCssVars(
      branding({ primary_color: "#1e3a8a" })
    ) as Record<string, string>;
    expect(vars["--district-primary-contrast"]).not.toBe("#1e3a8a");
    expect(vars["--district-primary-contrast"]).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("falls back to the configured default when the hex is malformed", () => {
    // Defense in depth: a bad value must never reach the rendered HTML.
    for (const bad of ["red", "#GGG", "#12345", "javascript:alert(1)", ""]) {
      const vars = brandingToCssVars(
        branding({ primary_color: bad })
      ) as Record<string, string>;
      expect(vars["--district-primary"]).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(vars["--district-primary"]).not.toBe(bad);
    }
  });

  it("quotes and escapes the district name for use in content:", () => {
    const vars = brandingToCssVars(
      branding({ name: 'Say "hi" \\ there' })
    ) as Record<string, string>;
    expect(vars["--district-name"]).toBe('"Say \\"hi\\" \\\\ there"');
  });
});
