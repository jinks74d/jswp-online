/**
 * Combined "Add a subject & class" action. One form creates a vertical slice of
 * the Subject -> Class -> Period -> Teacher hierarchy. Every level is
 * find-or-create so the form is idempotent: re-submitting reuses what exists
 * (e.g. an existing "English" subject) and only fills the gaps.
 *
 * Writes ride the RLS server client (the per-table *_admin_manage policies
 * enforce scope); requireRole is defense-in-depth. One combined audit_log row.
 *
 * NB: these inserts are not wrapped in a single transaction (supabase-js can't).
 * A failure partway leaves a subject/class with no period — the same "needs
 * period" state the subjects list already surfaces — rather than a hard error.
 */

"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit-log";

export type SubjectClassFormState = {
  error?: string;
  fieldErrors?: {
    subject_name?: string;
    class_name?: string;
    period_label?: string;
  };
  success?: string;
};

const MANAGE_ROLES = ["super_admin", "district_admin", "school_admin"] as const;

function isUniqueViolation(message: string | undefined): boolean {
  return /duplicate|unique|already exists/i.test(message ?? "");
}

export async function createSubjectClass(
  _prev: SubjectClassFormState,
  formData: FormData
): Promise<SubjectClassFormState> {
  const actor = await requireRole([...MANAGE_ROLES]);

  const schoolId = String(formData.get("school_id") ?? "");
  const subjectName = String(formData.get("subject_name") ?? "").trim();
  const className = String(formData.get("class_name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const periodLabel = String(formData.get("period_label") ?? "").trim();
  const teacherId = String(formData.get("teacher_id") ?? "").trim() || null;

  if (!schoolId) return { error: "Missing school id." };
  const fieldErrors: NonNullable<SubjectClassFormState["fieldErrors"]> = {};
  if (!subjectName) fieldErrors.subject_name = "Subject name is required.";
  if (!className) fieldErrors.class_name = "Class name is required.";
  if (!periodLabel) fieldErrors.period_label = "Period/block is required.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const supabase = await createServerClient();

  // Scope gate — an out-of-scope school reads back null under RLS.
  const { data: school } = await supabase
    .from("schools")
    .select("id")
    .eq("id", schoolId)
    .maybeSingle();
  if (!school) return { error: "School not found or outside your scope." };

  // 1) Find-or-create the subject by (school_id, name).
  let subjectId: string;
  {
    const { data: existing } = await supabase
      .from("subjects")
      .select("id")
      .eq("school_id", schoolId)
      .eq("name", subjectName)
      .maybeSingle();
    if (existing) {
      subjectId = existing.id;
    } else {
      const { data, error } = await supabase
        .from("subjects")
        .insert({ school_id: schoolId, name: subjectName })
        .select("id")
        .single();
      if (error || !data) {
        // Lost a race? Re-read before giving up.
        if (isUniqueViolation(error?.message)) {
          const { data: raced } = await supabase
            .from("subjects")
            .select("id")
            .eq("school_id", schoolId)
            .eq("name", subjectName)
            .maybeSingle();
          if (!raced) return { error: "Could not create the subject." };
          subjectId = raced.id;
        } else {
          return { error: error?.message ?? "Could not create the subject." };
        }
      } else {
        subjectId = data.id;
      }
    }
  }

  // 2) Find-or-create the class by (subject_id, name). Description is set only
  //    when the class is newly created — we don't overwrite an existing one.
  let classId: string;
  {
    const { data: existing } = await supabase
      .from("classes")
      .select("id")
      .eq("subject_id", subjectId)
      .eq("name", className)
      .maybeSingle();
    if (existing) {
      classId = existing.id;
    } else {
      const { data, error } = await supabase
        .from("classes")
        .insert({
          subject_id: subjectId,
          school_id: schoolId,
          name: className,
          description,
        })
        .select("id")
        .single();
      if (error || !data)
        return { error: error?.message ?? "Could not create the class." };
      classId = data.id;
    }
  }

  // 3) Find-or-create the period by (class_id, period_label) with no year.
  let periodId: string;
  {
    const { data: existing } = await supabase
      .from("class_periods")
      .select("id")
      .eq("class_id", classId)
      .eq("period_label", periodLabel)
      .is("academic_year", null)
      .maybeSingle();
    if (existing) {
      periodId = existing.id;
    } else {
      const { data, error } = await supabase
        .from("class_periods")
        .insert({
          class_id: classId,
          school_id: schoolId,
          period_label: periodLabel,
          academic_year: null,
          created_by: actor.id,
        })
        .select("id")
        .single();
      if (error || !data)
        return { error: error?.message ?? "Could not create the period." };
      periodId = data.id;
    }
  }

  // 4) Optional teacher — validate they're a teacher at THIS school, then assign.
  if (teacherId) {
    const { data: teacher } = await supabase
      .from("user_profiles")
      .select("id, role, school_id")
      .eq("id", teacherId)
      .maybeSingle();
    if (!teacher || teacher.role !== "teacher" || teacher.school_id !== schoolId) {
      return { error: "That teacher isn't at this school." };
    }

    const { count } = await supabase
      .from("class_teacher_assignments")
      .select("*", { count: "exact", head: true })
      .eq("class_period_id", periodId);

    const { error } = await supabase.from("class_teacher_assignments").insert({
      class_period_id: periodId,
      teacher_id: teacherId,
      is_primary: (count ?? 0) === 0,
      assigned_by: actor.id,
    });
    // Already assigned (re-submit) is fine — idempotent. Other errors surface.
    if (error && !isUniqueViolation(error.message)) {
      return { error: error.message };
    }
  }

  await writeAuditLog({
    actor_id: actor.id,
    action: "subject_class.create",
    target_scope: {
      subject_id: subjectId,
      class_id: classId,
      class_period_id: periodId,
      school_id: schoolId,
    },
    metadata: {
      subject_name: subjectName,
      class_name: className,
      period_label: periodLabel,
      teacher_id: teacherId,
    },
    school_id: schoolId,
  });

  revalidatePath("/admin/districts");
  revalidatePath("/district/classes");
  revalidatePath("/school/classes");
  return {
    success: `Added “${className}” (${subjectName}) — period ${periodLabel}.`,
  };
}
