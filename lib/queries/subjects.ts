/**
 * Subject read queries (level 1 of Subject -> Class -> Period). RLS scopes
 * reads to the caller's school/district (via the *_admin_manage FOR ALL
 * SELECT branch) or all for super admins.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import type { Subjects } from "@/lib/database.types";

export type SubjectListRow = Pick<
  Subjects,
  "id" | "name" | "description" | "created_at"
>;

export async function listSubjectsForSchool(
  schoolId: string
): Promise<SubjectListRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, description, created_at")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load subjects: ${error.message}`);
  return (data ?? []) as SubjectListRow[];
}

export async function getSubject(id: string): Promise<Subjects | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load subject: ${error.message}`);
  return (data as Subjects | null) ?? null;
}
