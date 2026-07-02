/**
 * Cross-district user reads for the super-admin /admin/users list. RLS
 * (user_profiles_super_admin_all) lets a super_admin read every user across
 * all districts, so no tenancy filter is applied here — the page re-gates to
 * super_admin. Unlike lib/queries/district-users.ts (district-scoped, with a
 * create flow), this is a read-only cross-tenant listing that also carries the
 * district name so super admins can see who belongs where.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";

export type AllUserRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string;
  districtName: string | null;
  schoolName: string | null;
  createdAt: string | null;
};

type UserSelectRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string;
  created_at: string | null;
  districts: { name: string } | { name: string }[] | null;
  schools: { name: string } | { name: string }[] | null;
};

const one = <T>(v: T | T[] | null): T | null =>
  Array.isArray(v) ? v[0] ?? null : v;

/** Every user across every district (newest first) with district + school. */
export async function listAllUsers(): Promise<AllUserRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "id, first_name, last_name, email, role, created_at, districts:district_id(name), schools:school_id(name)"
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load users: ${error.message}`);

  return ((data ?? []) as unknown as UserSelectRow[]).map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    role: row.role,
    districtName: one(row.districts)?.name ?? null,
    schoolName: one(row.schools)?.name ?? null,
    createdAt: row.created_at,
  }));
}
