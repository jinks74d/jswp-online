/**
 * Subject read queries (level 1 of Subject -> Class -> Period). RLS scopes
 * reads to the caller's school/district (via the *_admin_manage FOR ALL
 * SELECT branch) or all for super admins.
 *
 * Subjects are required to have at least one period (via a class). The list
 * carries a `hasPeriod` flag so the UI can flag period-less subjects as
 * incomplete; the admin must add a class + period.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import type { Database, Subjects } from "@/lib/database.types";

export type SubjectListRow = Pick<
  Subjects,
  "id" | "name" | "description" | "created_at"
> & { hasPeriod: boolean };

/** Subject ids (within a school) that have at least one class period. */
async function subjectIdsWithPeriods(
  supabase: SupabaseClient<Database>,
  schoolId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("class_periods")
    .select("class:class_id(subject_id)")
    .eq("school_id", schoolId);

  if (error) throw new Error(`Failed to load periods: ${error.message}`);

  const set = new Set<string>();
  for (const row of (data ?? []) as unknown as {
    class: { subject_id: string } | null;
  }[]) {
    if (row.class?.subject_id) set.add(row.class.subject_id);
  }
  return set;
}

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

  const withPeriods = await subjectIdsWithPeriods(supabase, schoolId);
  return (data ?? []).map((s) => ({
    ...(s as Pick<Subjects, "id" | "name" | "description" | "created_at">),
    hasPeriod: withPeriods.has(s.id),
  }));
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

/** True when the subject has at least one class period under it. */
export async function subjectHasPeriod(subjectId: string): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: classes, error } = await supabase
    .from("classes")
    .select("id")
    .eq("subject_id", subjectId);
  if (error) throw new Error(`Failed to load classes: ${error.message}`);

  const classIds = (classes ?? []).map((c) => c.id);
  if (classIds.length === 0) return false;

  const { count, error: perr } = await supabase
    .from("class_periods")
    .select("*", { count: "exact", head: true })
    .in("class_id", classIds);
  if (perr) throw new Error(`Failed to load periods: ${perr.message}`);

  return (count ?? 0) > 0;
}
