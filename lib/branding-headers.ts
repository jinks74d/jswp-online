/**
 * Server-only branding helpers. Reads the request-side x-jswp-district-*
 * headers set by middleware and exposes them as a typed branding object
 * plus a CSSProperties bag suitable for inline injection on <html>.
 *
 * Hex values are validated before they ever reach the rendered HTML —
 * defense-in-depth on top of the schema CHECK constraint. A malformed hex
 * silently falls back to the default rather than rendering a bogus value.
 */

import "server-only";

import { headers } from "next/headers";
import { generateBrandingCssVars } from "@/lib/district-branding.utils";
import {
  DISTRICT_BRANDING_CONFIG,
  type DistrictBranding,
} from "@/lib/district-branding.types";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function safeHex(v: string | null | undefined): string | null {
  return v && HEX_RE.test(v) ? v : null;
}

// Escape a string for embedding inside a CSS string literal value.
// Backslashes first, then double quotes — order matters.
function cssEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function getDistrictBrandingFromHeaders(): Promise<DistrictBranding> {
  const h = await headers();

  const id = h.get("x-jswp-district-id");
  const name = h.get("x-jswp-district-name");
  const primary = safeHex(h.get("x-jswp-district-primary"));
  const secondary = safeHex(h.get("x-jswp-district-secondary"));
  const logo = h.get("x-jswp-district-logo");

  return {
    id: id ?? "",
    name: name ?? "JSWP Online",
    logo_url: logo ?? null,
    primary_color: primary ?? DISTRICT_BRANDING_CONFIG.colors.defaultPrimary,
    secondary_color:
      secondary ?? DISTRICT_BRANDING_CONFIG.colors.defaultSecondary,
  };
}

export function brandingToCssVars(
  branding: DistrictBranding
): React.CSSProperties {
  // Re-validate hex values at the output boundary even though
  // getDistrictBrandingFromHeaders already did. Defense in depth — if a
  // caller passes in a hand-built branding object (e.g. tests, future
  // server-side code), we still don't render unsanitized values.
  const safePrimary =
    safeHex(branding.primary_color) ??
    DISTRICT_BRANDING_CONFIG.colors.defaultPrimary;
  const safeSecondary =
    safeHex(branding.secondary_color) ??
    DISTRICT_BRANDING_CONFIG.colors.defaultSecondary;

  const vars = generateBrandingCssVars({
    ...branding,
    primary_color: safePrimary,
    secondary_color: safeSecondary,
  });

  return {
    ...vars,
    // CSS string variable for the district name. Quoted so it's consumable
    // via `content: var(--district-name)`. Escaped for any embedded quotes
    // or backslashes.
    "--district-name": `"${cssEscape(branding.name)}"`,
  } as React.CSSProperties;
}
