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

export type DistrictPoc = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  invited_at: string | null;
};

/**
 * The primary/secondary POC accounts for a district. Returns null for a slot
 * whose FK is unset (legacy districts created before POCs existed). Super
 * admins read all user_profiles via user_profiles_super_admin_all.
 */
export async function getDistrictPocs(
  district: Pick<Districts, "primary_poc_id" | "secondary_poc_id">
): Promise<{ primary: DistrictPoc | null; secondary: DistrictPoc | null }> {
  const ids = [district.primary_poc_id, district.secondary_poc_id].filter(
    (v): v is string => !!v
  );
  if (ids.length === 0) return { primary: null, secondary: null };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, first_name, last_name, email, phone, invited_at")
    .in("id", ids);

  if (error) throw new Error(`Failed to load district POCs: ${error.message}`);

  const byId = new Map((data ?? []).map((p) => [p.id, p as DistrictPoc]));
  return {
    primary: district.primary_poc_id
      ? byId.get(district.primary_poc_id) ?? null
      : null,
    secondary: district.secondary_poc_id
      ? byId.get(district.secondary_poc_id) ?? null
      : null,
  };
}

/* ─── Districts overview (super-admin dashboard) ───────────────────────── */

export type DistrictCard = {
  id: string;
  name: string;
  subdomain: string | null;
  active: boolean;
  created_at: string;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  school_count: number;
  admin_count: number; // count of user_profiles with role 'district_admin' in that district
};

export type DistrictsOverview = {
  districts: DistrictCard[];
  stats: { total: number; active: number; schools: number };
};

type DistrictCardSource = Pick<
  Districts,
  | "id"
  | "name"
  | "subdomain"
  | "active"
  | "created_at"
  | "primary_color"
  | "secondary_color"
  | "logo_url"
>;

/**
 * Enriched overview for the super-admin Districts dashboard: every district
 * with its branding, school count, and district-admin count, plus rollup
 * stats. Super admins read all districts/schools/user_profiles via existing
 * RLS policies, so no admin client is needed. Counts are tallied in JS from
 * single flat queries to avoid per-district N+1s.
 */
export async function listDistrictsOverview(): Promise<DistrictsOverview> {
  const supabase = await createServerClient();

  const { data: districtRows, error: districtsError } = await supabase
    .from("districts")
    .select(
      "id, name, subdomain, active, created_at, primary_color, secondary_color, logo_url"
    )
    .order("name", { ascending: true });

  if (districtsError) {
    throw new Error(`Failed to load districts: ${districtsError.message}`);
  }

  const { data: schoolRows, error: schoolsError } = await supabase
    .from("schools")
    .select("district_id");

  if (schoolsError) {
    throw new Error(`Failed to load school counts: ${schoolsError.message}`);
  }

  const { data: adminRows, error: adminsError } = await supabase
    .from("user_profiles")
    .select("district_id")
    .eq("role", "district_admin");

  if (adminsError) {
    throw new Error(`Failed to load admin counts: ${adminsError.message}`);
  }

  const schoolCounts = new Map<string, number>();
  for (const row of schoolRows ?? []) {
    if (!row.district_id) continue;
    schoolCounts.set(row.district_id, (schoolCounts.get(row.district_id) ?? 0) + 1);
  }

  const adminCounts = new Map<string, number>();
  for (const row of adminRows ?? []) {
    if (!row.district_id) continue;
    adminCounts.set(row.district_id, (adminCounts.get(row.district_id) ?? 0) + 1);
  }

  const sources = (districtRows ?? []) as DistrictCardSource[];
  const districts: DistrictCard[] = sources.map((d) => ({
    id: d.id,
    name: d.name,
    subdomain: d.subdomain,
    active: d.active,
    created_at: d.created_at,
    primary_color: d.primary_color,
    secondary_color: d.secondary_color,
    logo_url: d.logo_url,
    school_count: schoolCounts.get(d.id) ?? 0,
    admin_count: adminCounts.get(d.id) ?? 0,
  }));

  return {
    districts,
    stats: {
      total: districts.length,
      active: districts.filter((d) => d.active).length,
      schools: schoolRows?.length ?? 0,
    },
  };
}
