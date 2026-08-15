/**
 * School read queries. RLS (schools_read_in_district) scopes results to the
 * caller's district, or all for super admins.
 */

import "server-only";

import { cache } from "react";
import { createServerClient } from "@/lib/supabase/server";
import type { Schools } from "@/lib/database.types";

/**
 * Just the school's accent colour, for the --brand style every authenticated
 * layout applies (see lib/brand-style.ts).
 *
 * Narrow and React cache()d because this runs on EVERY navigation inside the
 * teacher and student shells, which is the hottest path in the app. getSchool
 * would pull the whole row to read one column, and an uncached read would
 * repeat per render.
 *
 * Returns null rather than throwing: a missing or unreadable school must
 * degrade to the district colour, never blank the page a student is writing in.
 */
export const getSchoolPrimaryColor = cache(async function getSchoolPrimaryColor(
  schoolId: string
): Promise<string | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("schools")
    .select("primary_color")
    .eq("id", schoolId)
    .maybeSingle();

  if (error) return null;
  return (data as { primary_color: string | null } | null)?.primary_color ?? null;
});

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
