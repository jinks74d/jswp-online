/**
 * School-admin dashboard reads. Scoped to the admin's own school. RLS already
 * limits user_profiles / classes / assignments to that school, so these queries
 * filter by school_id for clarity and rely on RLS for enforcement.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";

export type SchoolStats = {
  teachers: number;
  students: number;
  classes: number;
  assignments: number;
  /** Users (any role) added since `sinceIso`. */
  growth: number;
};

export async function getSchoolStats(
  schoolId: string,
  sinceIso: string
): Promise<SchoolStats> {
  const supabase = await createServerClient();
  const head = { count: "exact" as const, head: true };

  const [teachers, students, classes, assignments, growth] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id", head)
      .eq("school_id", schoolId)
      .eq("role", "teacher"),
    supabase
      .from("user_profiles")
      .select("id", head)
      .eq("school_id", schoolId)
      .eq("role", "student"),
    supabase.from("classes").select("id", head).eq("school_id", schoolId),
    supabase.from("assignments").select("id", head).eq("school_id", schoolId),
    supabase
      .from("user_profiles")
      .select("id", head)
      .eq("school_id", schoolId)
      .gte("created_at", sinceIso),
  ]);

  for (const r of [teachers, students, classes, assignments, growth]) {
    if (r.error)
      throw new Error(`Failed to load school stats: ${r.error.message}`);
  }

  return {
    teachers: teachers.count ?? 0,
    students: students.count ?? 0,
    classes: classes.count ?? 0,
    assignments: assignments.count ?? 0,
    growth: growth.count ?? 0,
  };
}

export type RecentSchoolUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  createdAt: string | null;
};

/** Newest teachers + students at the school, for the Recent Users panel. */
export async function listRecentSchoolUsers(
  schoolId: string,
  limit = 4
): Promise<RecentSchoolUser[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, first_name, last_name, role, created_at")
    .eq("school_id", schoolId)
    .in("role", ["teacher", "student"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load recent users: ${error.message}`);

  return ((data ?? []) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    role: string;
    created_at: string | null;
  }[]).map((u) => ({
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    role: u.role,
    createdAt: u.created_at,
  }));
}
