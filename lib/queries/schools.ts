/**
 * School read queries. RLS (schools_read_in_district) scopes results to the
 * caller's district, or all for super admins.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import type { Schools } from "@/lib/database.types";

export type SchoolListRow = Pick<
  Schools,
  "id" | "name" | "level" | "active" | "address" | "created_at"
>;

export async function listSchoolsForDistrict(
  districtId: string
): Promise<SchoolListRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("schools")
    .select("id, name, level, active, address, created_at")
    .eq("district_id", districtId)
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load schools: ${error.message}`);
  return (data ?? []) as SchoolListRow[];
}

/**
 * Count active user_profiles per school across a district, returned as a
 * { school_id: count } map. RLS scopes the read to the caller's district.
 * Schools with no users are simply absent from the map (treat as 0).
 */
export async function getSchoolUserCounts(
  districtId: string
): Promise<Record<string, number>> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("school_id")
    .eq("district_id", districtId)
    .not("school_id", "is", null);

  if (error) throw new Error(`Failed to count school users: ${error.message}`);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const sid = (row as { school_id: string | null }).school_id;
    if (sid) counts[sid] = (counts[sid] ?? 0) + 1;
  }
  return counts;
}

export async function getSchool(id: string): Promise<Schools | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("schools")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load school: ${error.message}`);
  return (data as Schools | null) ?? null;
}
