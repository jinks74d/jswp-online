/**
 * Single source of truth for school-admin kinds.
 *
 * A school admin's `user_profiles.admin_kind` shares the same authorization
 * scope (role = 'school_admin') but selects which dashboard they land on. This
 * module owns the canonical list, labels, the default, and the dashboard route
 * map, so the creation form, the server action, the routing redirect, and the
 * detail-page display all agree.
 */

import type { Database } from "@/lib/database.types";

export type AdminKind = Database["public"]["Enums"]["jswp_admin_kind"];

export type AdminKindOption = {
  readonly value: AdminKind;
  readonly label: string;
};

export const ADMIN_KINDS: readonly AdminKindOption[] = [
  { value: "administrator", label: "Administrator" },
  { value: "counselor", label: "Counselor" },
  { value: "other", label: "Other" },
];

/** Fallback for school admins with no kind set (pre-0026 rows / bad input). */
export const DEFAULT_ADMIN_KIND: AdminKind = "administrator";

const VALUES = new Set<string>(ADMIN_KINDS.map((k) => k.value));
const LABEL_BY_VALUE = new Map<string, string>(
  ADMIN_KINDS.map((k) => [k.value, k.label])
);

/** Narrows an arbitrary string to a valid AdminKind, or returns null. */
export function parseAdminKind(value: string | null | undefined): AdminKind | null {
  return value && VALUES.has(value) ? (value as AdminKind) : null;
}

/** Coerces a possibly-null kind to a usable one, applying the default. */
export function resolveAdminKind(value: string | null | undefined): AdminKind {
  return parseAdminKind(value) ?? DEFAULT_ADMIN_KIND;
}

/** Display label for a kind (e.g. on the school-admins table). */
export function adminKindLabel(value: string | null | undefined): string {
  return LABEL_BY_VALUE.get(value ?? "") ?? LABEL_BY_VALUE.get(DEFAULT_ADMIN_KIND)!;
}

/** Dashboard route for a school admin of the given kind. */
export function adminDashboardPath(value: string | null | undefined): string {
  return `/admin/school/${resolveAdminKind(value)}`;
}
