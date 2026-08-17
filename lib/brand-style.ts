/**
 * Resolve the accent colour a subtree should use, as the --brand CSS vars
 * that globals.css and every component read.
 *
 * Precedence is school → district → caller's fallback. A school that sets its
 * own colour re-accents the whole surface beneath this style; a school that
 * does not inherits its district's; and if neither resolves, the caller may
 * supply a default or get {} back, which leaves the :root definition in
 * globals.css (itself derived from the district) in charge.
 *
 * Returning {} rather than a hardcoded colour matters: an empty style object
 * sets no custom properties at all, so inheritance from :root continues to
 * work. Emitting a default here instead would PIN the subtree to that default
 * and defeat the district branding the middleware already resolved.
 *
 * Pure and free of `server-only` on purpose — it is applied by server layouts
 * but is just colour arithmetic, and keeping it importable is what makes the
 * precedence rules testable.
 */

import type React from "react";
import { isValidHexColor } from "@/lib/district-branding.types";
import { hexToRgb, getContrastColor } from "@/lib/district-branding.utils";

/**
 * Rose-600 — the historic accent of the /school and /district admin shells,
 * used when neither the school nor its district sets a colour. Passing it as
 * the `fallback` is what lets those surfaces move onto --brand without
 * changing how an unbranded tenant looks.
 *
 * Not the same thing as the /admin accent: that console is cross-district, so
 * it keeps a fixed rose rather than resolving a tenant's colour. The full
 * which-surfaces-brand table is in CLAUDE.md §14.10.
 */
export const ADMIN_SHELL_DEFAULT_BRAND = "#e11d48";

function valid(c: string | null | undefined): string | null {
  return c && isValidHexColor(c) ? c : null;
}

export function brandStyle(
  schoolPrimary: string | null | undefined,
  districtPrimary: string | null | undefined,
  fallback?: string
): React.CSSProperties {
  const brand = valid(schoolPrimary) ?? valid(districtPrimary) ?? valid(fallback);

  // Nothing resolved — inherit :root rather than pinning a colour.
  if (!brand) return {};

  const rgb = hexToRgb(brand);
  // hexToRgb only fails on input isValidHexColor already accepted, but the
  // soft tints below would silently produce "rgba(undefined…)" if it ever did.
  if (!rgb) return {};

  const tuple = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
  return {
    "--brand": brand,
    "--brand-contrast": getContrastColor(brand),
    "--brand-rgb": tuple,
    "--brand-soft": `rgba(${tuple}, 0.1)`,
    "--brand-soft-strong": `rgba(${tuple}, 0.18)`,
  } as React.CSSProperties;
}
