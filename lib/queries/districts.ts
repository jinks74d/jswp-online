/**
 * District read queries (super-admin management). Reads go through the RLS
 * server client — districts_read_self lets super admins see all districts and
 * a district admin see their own.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import type { Districts } from "@/lib/database.types";

export type DistrictListRow = Pick<
  Districts,
  "id" | "name" | "subdomain" | "active" | "created_at"
>;

export async function listDistricts(): Promise<DistrictListRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("districts")
    .select("id, name, subdomain, active, created_at")
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load districts: ${error.message}`);
  return (data ?? []) as DistrictListRow[];
}

export async function getDistrict(id: string): Promise<Districts | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("districts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load district: ${error.message}`);
  return (data as Districts | null) ?? null;
}
