/**
 * District-wide user reads for /district/users. RLS scopes user_profiles to the
 * caller's district (user_profiles_district_admin_manage), so no extra filter.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";

export type DistrictUserRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string;
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
  schools: { name: string } | { name: string }[] | null;
};

const one = <T>(v: T | T[] | null): T | null =>
  Array.isArray(v) ? v[0] ?? null : v;

/** Every user in the district (newest first) with their school name. */
export async function listDistrictUsers(): Promise<DistrictUserRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "id, first_name, last_name, email, role, created_at, schools:school_id(name)"
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load users: ${error.message}`);

  return ((data ?? []) as unknown as UserSelectRow[]).map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    role: row.role,
    schoolName: one(row.schools)?.name ?? null,
    createdAt: row.created_at,
  }));
}
