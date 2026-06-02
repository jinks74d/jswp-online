/**
 * School read queries. RLS (schools_read_in_district) scopes results to the
 * caller's district, or all for super admins.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import type { Schools } from "@/lib/database.types";

export type SchoolListRow = Pick<
  Schools,
  "id" | "name" | "level" | "active" | "created_at"
>;

export async function listSchoolsForDistrict(
  districtId: string
): Promise<SchoolListRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("schools")
    .select("id, name, level, active, created_at")
    .eq("district_id", districtId)
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load schools: ${error.message}`);
  return (data ?? []) as SchoolListRow[];
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
