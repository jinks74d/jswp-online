/**
 * District-admin dashboard read queries. All RLS-scoped to the caller's
 * district (schools_read_in_district + user_profiles_district_admin_manage).
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";

export type DistrictStats = {
  schools: number;
  administrators: number;
  teachers: number;
  students: number;
};

/** Headline counts for the four stat cards. */
export async function getDistrictStats(
  districtId: string
): Promise<DistrictStats> {
  const supabase = await createServerClient();
  const [roles, schools] = await Promise.all([
    supabase.from("user_profiles").select("role").eq("district_id", districtId),
    supabase
      .from("schools")
      .select("id", { count: "exact", head: true })
      .eq("district_id", districtId),
  ]);

  if (roles.error)
    throw new Error(`Failed to load district roles: ${roles.error.message}`);
  if (schools.error)
    throw new Error(`Failed to count schools: ${schools.error.message}`);

  let administrators = 0;
  let teachers = 0;
  let students = 0;
  for (const row of roles.data ?? []) {
    const role = (row as { role: string }).role;
    if (role === "district_admin" || role === "school_admin") administrators++;
    else if (role === "teacher") teachers++;
    else if (role === "student") students++;
  }

  return {
    schools: schools.count ?? 0,
    administrators,
    teachers,
    students,
  };
}

export type RecentSchool = {
  id: string;
  name: string;
  address: string | null;
  created_at: string | null;
};

/** Newest schools in the district, for the "Recent Schools" panel. */
export async function listRecentSchools(
  districtId: string,
  limit = 5
): Promise<RecentSchool[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("schools")
    .select("id, name, address, created_at")
    .eq("district_id", districtId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load recent schools: ${error.message}`);
  return (data ?? []) as RecentSchool[];
}

export type RecentUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  school_name: string | null;
  created_at: string | null;
};

type RecentUserRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  created_at: string | null;
  // Embedded to-one school; the client may surface it as an object or array.
  schools: { name: string | null } | { name: string | null }[] | null;
};

/** Newest users in the district (with their school), for "Recent Users". */
export async function listRecentUsers(
  districtId: string,
  limit = 5
): Promise<RecentUser[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, first_name, last_name, role, created_at, schools:school_id(name)")
    .eq("district_id", districtId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load recent users: ${error.message}`);

  return ((data ?? []) as RecentUserRow[]).map((row) => {
    const school = Array.isArray(row.schools) ? row.schools[0] : row.schools;
    return {
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      role: row.role,
      school_name: school?.name ?? null,
      created_at: row.created_at,
    };
  });
}
