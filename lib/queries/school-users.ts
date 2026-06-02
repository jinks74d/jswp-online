/**
 * School-scoped user lists (admins / teachers / students). RLS scopes reads to
 * the caller's district or school; super admins see all.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";

export type SchoolUserRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  active: boolean;
  created_at: string;
};

export async function listSchoolUsersByRole(
  schoolId: string,
  role: "school_admin" | "teacher" | "student"
): Promise<SchoolUserRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, first_name, last_name, email, active, created_at")
    .eq("school_id", schoolId)
    .eq("role", role)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load ${role}s: ${error.message}`);
  return (data ?? []) as SchoolUserRow[];
}
