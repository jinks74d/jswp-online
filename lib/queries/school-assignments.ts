/**
 * School-admin assignment monitoring reads for /school/assignments. School
 * admins have read-only access (assignments_admin_read + student_writings_admin_
 * read), so this surfaces status + submission counts but never writes.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import {
  distinctDueDates,
  earliestDueAt,
} from "@/lib/assignment-due-dates";

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
  teacher:
    | { first_name: string | null; last_name: string | null }
    | { first_name: string | null; last_name: string | null }[]
    | null;
  assignment_class_periods: {
    class_period_id: string;
    due_at: string | null;
    period: PeriodEmbed | PeriodEmbed[] | null;
  }[];
};

type PeriodEmbed = {
  period_label: string;
  class:
    | { name: string; subject: { name: string } | { name: string }[] | null }
    | { name: string; subject: { name: string } | { name: string }[] | null }[]
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
      `id, title, due_at, released_at,
       teacher:teacher_id ( first_name, last_name ),
       assignment_class_periods (
         class_period_id,
         due_at,
         period:class_period_id ( period_label, class:class_id ( name, subject:subject_id ( name ) ) )
       )`
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
      assignments.flatMap((a) =>
        (a.assignment_class_periods ?? []).map((p) => p.class_period_id)
      )
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
    // Ordered by label before anything reads [0]. PostgREST gives no ordering
    // guarantee for an embedded resource, so an unsorted periods[0] means the
    // class shown — and the one the "+N" hangs off — can differ between
    // renders of identical data. Every other use below (due dates, subjects,
    // enrolment totals) is order-independent, so sorting here is free.
    const periods = [...(a.assignment_class_periods ?? [])].sort((p, q) =>
      (one(p.period)?.period_label ?? "").localeCompare(
        one(q.period)?.period_label ?? ""
      )
    );
    // An assignment can now span several classes. The row still shows one
    // class, so show the first and let the count carry the rest; every
    // subject it touches is collected for the filter.
    const firstPeriod = periods[0] ? one(periods[0].period) : null;
    const klass = firstPeriod ? one(firstPeriod.class) : null;
    const subjectName = klass ? one(klass.subject)?.name ?? null : null;
    for (const p of periods) {
      const s = one(one(p.period)?.class ?? null);
      const n = s ? one(s.subject)?.name : null;
      if (n) subjectSet.add(n);
    }

    // Overdue is judged against the LAST deadline any of its classes has —
    // the assignment is not finished while one class still has time left.
    const latestDue = distinctDueDates(a.due_at, periods).pop() ?? a.due_at;

    // due_at is a calendar-only date (UTC midnight); it's overdue once the
    // whole due day has elapsed, not the instant UTC midnight passes.
    const status: AssignmentStatus = !a.released_at
      ? "draft"
      : latestDue && new Date(latestDue).getTime() + 86_400_000 <= now
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
      periodLabel:
        periods.length > 1
          ? `${firstPeriod?.period_label ?? "—"} +${periods.length - 1}`
          : firstPeriod?.period_label ?? null,
      dueAt: earliestDueAt(a.due_at, periods),
      status,
      submitted,
      // The "X / Y submitted" denominator has to span every class the
      // assignment went to, or a two-period assignment reads as over-100%.
      enrolled: periods.reduce(
        (sum, p) => sum + (enrolledByPeriod.get(p.class_period_id) ?? 0),
        0
      ),
    };
  });

  // Sort on the value the table actually SHOWS. The query orders by the raw
  // assignments.due_at column, but each row displays earliestDueAt(...) — the
  // soonest deadline across its classes. The moment any period sets its own
  // date the two disagree, and the Due column reads as out of order against
  // its own sort. Re-sorting here keeps the DB order as the tiebreaker for
  // rows whose derived dates match.
  //
  // Undated rows sink to the bottom: a row with no deadline should not lead a
  // list ordered by deadline. In practice this is unreachable — the assignment
  // form requires a due date — so it only guards legacy or imported rows.
  rows.sort((x, y) => {
    if (x.dueAt === y.dueAt) return 0;
    if (!x.dueAt) return 1;
    if (!y.dueAt) return -1;
    return new Date(y.dueAt).getTime() - new Date(x.dueAt).getTime();
  });

  return {
    rows,
    stats: { total: rows.length, active, pendingGrading, submissions },
    subjects: [...subjectSet].sort(),
  };
}
