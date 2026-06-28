/**
 * School-admin assignment monitoring reads for /school/assignments. School
 * admins have read-only access (assignments_admin_read + student_writings_admin_
 * read), so this surfaces status + submission counts but never writes.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";

export type AssignmentStatus = "draft" | "active" | "overdue";

export type SchoolAssignmentRow = {
  id: string;
  title: string;
  teacherName: string;
  subjectName: string | null;
  className: string | null;
  periodLabel: string | null;
  dueAt: string | null;
  status: AssignmentStatus;
  submitted: number;
  enrolled: number;
};

export type SchoolAssignmentStats = {
  total: number;
  active: number;
  pendingGrading: number;
  submissions: number;
};

export type SchoolAssignmentsResult = {
  rows: SchoolAssignmentRow[];
  stats: SchoolAssignmentStats;
  subjects: string[];
};

type AssignmentSelectRow = {
  id: string;
  title: string;
  due_at: string | null;
  released_at: string | null;
  class_period_id: string | null;
  teacher:
    | { first_name: string | null; last_name: string | null }
    | { first_name: string | null; last_name: string | null }[]
    | null;
  period:
    | {
        period_label: string;
        class:
          | { name: string; subject: { name: string } | { name: string }[] | null }
          | { name: string; subject: { name: string } | { name: string }[] | null }[]
          | null;
      }
    | {
        period_label: string;
        class:
          | { name: string; subject: { name: string } | { name: string }[] | null }
          | { name: string; subject: { name: string } | { name: string }[] | null }[]
          | null;
      }[]
    | null;
};

const one = <T>(v: T | T[] | null): T | null =>
  Array.isArray(v) ? v[0] ?? null : v;

// A writing counts as "submitted" once it leaves the student's hands.
const SUBMITTED = new Set(["submitted", "returned", "graded"]);

export async function getSchoolAssignments(
  schoolId: string
): Promise<SchoolAssignmentsResult> {
  const supabase = await createServerClient();

  const { data: aData, error: aErr } = await supabase
    .from("assignments")
    .select(
      `id, title, due_at, released_at, class_period_id,
       teacher:teacher_id ( first_name, last_name ),
       period:class_period_id ( period_label, class:class_id ( name, subject:subject_id ( name ) ) )`
    )
    .eq("school_id", schoolId)
    .order("due_at", { ascending: false });
  if (aErr) throw new Error(`Failed to load assignments: ${aErr.message}`);

  const assignments = (aData ?? []) as unknown as AssignmentSelectRow[];

  // Submission counts per assignment + pending-grading total (status=submitted).
  const { data: wData, error: wErr } = await supabase
    .from("student_writings")
    .select("assignment_id, status");
  if (wErr) throw new Error(`Failed to load writings: ${wErr.message}`);

  const submittedByAssignment = new Map<string, number>();
  let pendingGrading = 0;
  for (const w of (wData ?? []) as { assignment_id: string; status: string }[]) {
    if (SUBMITTED.has(w.status)) {
      submittedByAssignment.set(
        w.assignment_id,
        (submittedByAssignment.get(w.assignment_id) ?? 0) + 1
      );
    }
    if (w.status === "submitted") pendingGrading += 1;
  }

  // Enrolled counts per class period (for the "X / Y submitted" denominator).
  const periodIds = [
    ...new Set(
      assignments.map((a) => a.class_period_id).filter((id): id is string => !!id)
    ),
  ];
  const enrolledByPeriod = new Map<string, number>();
  if (periodIds.length > 0) {
    const { data: eData, error: eErr } = await supabase
      .from("class_student_enrollments")
      .select("class_period_id")
      .in("class_period_id", periodIds);
    if (eErr) throw new Error(`Failed to load enrollments: ${eErr.message}`);
    for (const r of (eData ?? []) as { class_period_id: string }[]) {
      enrolledByPeriod.set(
        r.class_period_id,
        (enrolledByPeriod.get(r.class_period_id) ?? 0) + 1
      );
    }
  }

  const now = Date.now();
  const subjectSet = new Set<string>();
  let active = 0;
  let submissions = 0;

  const rows: SchoolAssignmentRow[] = assignments.map((a) => {
    const teacher = one(a.teacher);
    const period = one(a.period);
    const klass = period ? one(period.class) : null;
    const subject = klass ? one(klass.subject) : null;
    const subjectName = subject?.name ?? null;
    if (subjectName) subjectSet.add(subjectName);

    const status: AssignmentStatus = !a.released_at
      ? "draft"
      : a.due_at && new Date(a.due_at).getTime() < now
        ? "overdue"
        : "active";
    if (status === "active") active += 1;

    const submitted = submittedByAssignment.get(a.id) ?? 0;
    submissions += submitted;

    return {
      id: a.id,
      title: a.title,
      teacherName:
        [teacher?.first_name, teacher?.last_name].filter(Boolean).join(" ") ||
        "Unknown teacher",
      subjectName,
      className: klass?.name ?? null,
      periodLabel: period?.period_label ?? null,
      dueAt: a.due_at,
      status,
      submitted,
      enrolled: a.class_period_id
        ? enrolledByPeriod.get(a.class_period_id) ?? 0
        : 0,
    };
  });

  return {
    rows,
    stats: { total: rows.length, active, pendingGrading, submissions },
    subjects: [...subjectSet].sort(),
  };
}
