/**
 * Per-student progress (chunk 5.3).
 *
 * Returns one student's progress *as seen by a specific teacher*. Scope:
 *  1. Teacher's class periods (class_teacher_assignments).
 *  2. Student's active enrollments in those periods (intersection).
 *  3. Teacher's assignments on those periods, released_at IS NOT NULL.
 *  4. Student's writings on those assignments.
 *  5. rubric_scores for those writings.
 *
 * Outside-of-scope students yield { state: "not_in_scope" }. The caller
 * surfaces that as a 404 (matches the existing getStudentDetail
 * contract).
 *
 * Aggregations:
 *  - Most-recent draft per (student, assignment) wins. Same rule as 5.2.
 *  - Score timeline includes only graded writings with a known max. For
 *    non-rubric assignments the max falls back to 100 (assumed 0-100
 *    grading scale).
 *  - Criterion trends aggregate rubric_scores by criterion_name string
 *    match. Cross-assignment max-score divergence (teacher edited the
 *    rubric mid-cohort) is normalized to percentage in the chart layer.
 *
 * Most heavy lifting happens in two parallel-after-scope batches:
 *  - Phase 1: teacher's periods + student's enrollments (intersection).
 *  - Phase 2: assignments + writings + rubric_scores fired together.
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { loadRubric } from "@/lib/rubric";
import type { Database } from "@/lib/database.types";

type WritingStatus = Database["public"]["Enums"]["jswp_writing_status"];
type Mode = Database["public"]["Enums"]["jswp_mode"];

export interface StudentProgressRubricScore {
  criterionName: string;
  score: number;
  maxScore: number;
  levelLabel: string | null;
}

export interface StudentProgressAssignment {
  id: string;
  title: string;
  mode: Mode;
  releasedAt: string | null;
  dueAt: string | null;
  writingId: string | null;
  writingStatus: WritingStatus | null;
  submittedAt: string | null;
  gradedAt: string | null;
  totalScore: number | null;
  rubricMaxScore: number | null;
  rubricScores: ReadonlyArray<StudentProgressRubricScore>;
}

export interface StudentProgressTimelinePoint {
  assignmentId: string;
  assignmentTitle: string;
  gradedAt: string;
  score: number;
  maxScore: number;
  percentage: number;
}

export interface StudentProgressCriterionDataPoint {
  assignmentId: string;
  assignmentTitle: string;
  score: number;
  maxScore: number;
  gradedAt: string;
  percentage: number;
}

export interface StudentProgressCriterionTrend {
  criterionName: string;
  averagePercentage: number;
  dataPoints: ReadonlyArray<StudentProgressCriterionDataPoint>;
}

export interface StudentProgressSummary {
  totalAssignments: number;
  gradedCount: number;
  averagePercentage: number | null;
}

export interface StudentProgressData {
  assignments: ReadonlyArray<StudentProgressAssignment>;
  timeline: ReadonlyArray<StudentProgressTimelinePoint>;
  criterionTrends: ReadonlyArray<StudentProgressCriterionTrend>;
  summary: StudentProgressSummary;
}

export type StudentProgressResult =
  | { state: "ok"; data: StudentProgressData }
  | { state: "not_in_scope" };

// Non-rubric assignments don't carry a max in the schema. Fall back to
// 100 for percentage math; teachers using a 0-100 grading scale get the
// right tier coloring. Teachers using something else get a coherent but
// not-quite-right percentage. Documented limitation; v1.
const NON_RUBRIC_DEFAULT_MAX = 100;

export async function getStudentProgress(
  studentId: string,
  teacherId: string
): Promise<StudentProgressResult> {
  const supabase = await createServerClient();

  // ── Phase 1: scope intersection ─────────────────────────────────────
  const { data: teacherPeriods } = await supabase
    .from("class_teacher_assignments")
    .select("class_period_id")
    .eq("teacher_id", teacherId);

  if (!teacherPeriods || teacherPeriods.length === 0) {
    return { state: "not_in_scope" };
  }
  const teacherPeriodIds = teacherPeriods.map((p) => p.class_period_id);

  const { data: enrollments } = await supabase
    .from("class_student_enrollments")
    .select("class_period_id")
    .eq("student_id", studentId)
    .in("class_period_id", teacherPeriodIds)
    .is("unenrolled_at", null);

  if (!enrollments || enrollments.length === 0) {
    return { state: "not_in_scope" };
  }
  const scopedPeriodIds = enrollments.map((e) => e.class_period_id);

  // ── Phase 2: parallel reads ─────────────────────────────────────────
  const [assignmentsRes, writingsRes, rubricScoresRes] = await Promise.all([
    supabase
      .from("assignments")
      .select(
        "id, title, mode, released_at, due_at, class_period_id, rubric"
      )
      .eq("teacher_id", teacherId)
      .in("class_period_id", scopedPeriodIds)
      .not("released_at", "is", null),
    supabase
      .from("student_writings")
      .select(
        "id, assignment_id, status, draft_number, submitted_at, graded_at, total_score"
      )
      .eq("student_id", studentId),
    supabase
      .from("rubric_scores")
      .select(
        `
        criterion_name, score, max_score, level_label,
        student_writing:student_writing_id!inner (
          id, assignment_id, student_id, status, draft_number, graded_at
        )
        `
      )
      .eq("student_writing.student_id", studentId),
  ]);

  if (assignmentsRes.error) {
    console.error("getStudentProgress assignments:", assignmentsRes.error);
    return { state: "not_in_scope" };
  }
  if (writingsRes.error) {
    console.error("getStudentProgress writings:", writingsRes.error);
    return { state: "not_in_scope" };
  }
  if (rubricScoresRes.error) {
    console.error("getStudentProgress rubric_scores:", rubricScoresRes.error);
    return { state: "not_in_scope" };
  }

  type AssignmentRow = {
    id: string;
    title: string;
    mode: Mode;
    released_at: string | null;
    due_at: string | null;
    class_period_id: string | null;
    rubric: Database["public"]["Tables"]["assignments"]["Row"]["rubric"];
  };
  type WritingRow = {
    id: string;
    assignment_id: string;
    status: WritingStatus;
    draft_number: number;
    submitted_at: string | null;
    graded_at: string | null;
    total_score: number | null;
  };
  type RubricScoreRow = {
    criterion_name: string;
    score: number;
    max_score: number;
    level_label: string | null;
    student_writing:
      | {
          id: string;
          assignment_id: string;
          student_id: string;
          status: WritingStatus;
          draft_number: number;
          graded_at: string | null;
        }
      | Array<{
          id: string;
          assignment_id: string;
          student_id: string;
          status: WritingStatus;
          draft_number: number;
          graded_at: string | null;
        }>
      | null;
  };

  const assignmentRows = (assignmentsRes.data ?? []) as unknown as AssignmentRow[];
  const writingRows = (writingsRes.data ?? []) as unknown as WritingRow[];
  const rubricScoreRows = (rubricScoresRes.data ?? []) as unknown as RubricScoreRow[];

  // ── Most-recent draft per assignment ────────────────────────────────
  const latestWritingByAssignment = new Map<string, WritingRow>();
  for (const w of writingRows) {
    const current = latestWritingByAssignment.get(w.assignment_id);
    if (!current || w.draft_number > current.draft_number) {
      latestWritingByAssignment.set(w.assignment_id, w);
    }
  }

  // ── Rubric scores indexed by writing_id, filtered to latest drafts ──
  const rubricScoresByWriting = new Map<string, StudentProgressRubricScore[]>();
  for (const r of rubricScoreRows) {
    const sw = Array.isArray(r.student_writing)
      ? r.student_writing[0]
      : r.student_writing;
    if (!sw) continue;
    const latest = latestWritingByAssignment.get(sw.assignment_id);
    if (!latest || latest.id !== sw.id) continue;
    if (latest.status !== "graded") continue;

    const list = rubricScoresByWriting.get(sw.id) ?? [];
    list.push({
      criterionName: r.criterion_name,
      score: Number(r.score),
      maxScore: Number(r.max_score),
      levelLabel: r.level_label,
    });
    rubricScoresByWriting.set(sw.id, list);
  }

  // ── Per-assignment shape ────────────────────────────────────────────
  const assignments: StudentProgressAssignment[] = assignmentRows.map((a) => {
    const latest = latestWritingByAssignment.get(a.id);
    const rubric = loadRubric(a.rubric);
    const rubricMax =
      rubric.criteria.length > 0
        ? rubric.criteria.reduce(
            (sum, c) =>
              sum +
              (c.levels.length > 0
                ? Math.max(...c.levels.map((l) => l.score))
                : 0),
            0
          )
        : null;

    const rubricScores =
      latest && rubricScoresByWriting.has(latest.id)
        ? (rubricScoresByWriting.get(latest.id) as StudentProgressRubricScore[])
        : [];

    return {
      id: a.id,
      title: a.title,
      mode: a.mode,
      releasedAt: a.released_at,
      dueAt: a.due_at,
      writingId: latest?.id ?? null,
      writingStatus: latest?.status ?? null,
      submittedAt: latest?.submitted_at ?? null,
      gradedAt: latest?.graded_at ?? null,
      totalScore: latest?.total_score !== undefined && latest.total_score !== null
        ? Number(latest.total_score)
        : null,
      rubricMaxScore: rubricMax,
      rubricScores,
    };
  });

  // Most-recent first by released_at (assignment list ordering).
  assignments.sort((a, b) =>
    (b.releasedAt ?? "").localeCompare(a.releasedAt ?? "")
  );

  // ── Timeline: graded writings, oldest-first by graded_at ────────────
  const timeline: StudentProgressTimelinePoint[] = assignments
    .filter(
      (a) =>
        a.writingStatus === "graded" &&
        a.gradedAt !== null &&
        a.totalScore !== null
    )
    .map((a) => {
      const maxScore = a.rubricMaxScore ?? NON_RUBRIC_DEFAULT_MAX;
      const score = a.totalScore as number;
      const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
      return {
        assignmentId: a.id,
        assignmentTitle: a.title,
        gradedAt: a.gradedAt as string,
        score,
        maxScore,
        percentage,
      };
    })
    .sort((a, b) => a.gradedAt.localeCompare(b.gradedAt));

  // ── Criterion trends: aggregate by criterion_name (snapshot) ────────
  // Edge case: same name with different max scores across assignments
  // (rubric edited mid-cohort). Normalized to percentage at chart layer.
  type Aggregator = {
    criterionName: string;
    dataPoints: StudentProgressCriterionDataPoint[];
  };
  const aggByName = new Map<string, Aggregator>();

  for (const a of assignments) {
    if (a.writingStatus !== "graded" || !a.gradedAt) continue;
    for (const r of a.rubricScores) {
      const pct = r.maxScore > 0 ? (r.score / r.maxScore) * 100 : 0;
      const agg = aggByName.get(r.criterionName) ?? {
        criterionName: r.criterionName,
        dataPoints: [],
      };
      agg.dataPoints.push({
        assignmentId: a.id,
        assignmentTitle: a.title,
        score: r.score,
        maxScore: r.maxScore,
        gradedAt: a.gradedAt,
        percentage: pct,
      });
      aggByName.set(r.criterionName, agg);
    }
  }

  const criterionTrends: StudentProgressCriterionTrend[] = Array.from(
    aggByName.values()
  ).map((agg) => {
    const sortedPoints = [...agg.dataPoints].sort((a, b) =>
      a.gradedAt.localeCompare(b.gradedAt)
    );
    const avgPct =
      sortedPoints.reduce((s, p) => s + p.percentage, 0) / sortedPoints.length;
    return {
      criterionName: agg.criterionName,
      averagePercentage: avgPct,
      dataPoints: sortedPoints,
    };
  });
  // Weakest first.
  criterionTrends.sort((a, b) => a.averagePercentage - b.averagePercentage);

  // ── Summary ─────────────────────────────────────────────────────────
  const gradedAssignments = assignments.filter(
    (a) => a.writingStatus === "graded"
  );
  const gradedWithPercentage = gradedAssignments.map((a) => {
    const max = a.rubricMaxScore ?? NON_RUBRIC_DEFAULT_MAX;
    return max > 0 ? ((a.totalScore ?? 0) / max) * 100 : 0;
  });
  const avgPct =
    gradedWithPercentage.length > 0
      ? gradedWithPercentage.reduce((s, p) => s + p, 0) /
        gradedWithPercentage.length
      : null;

  return {
    state: "ok",
    data: {
      assignments,
      timeline,
      criterionTrends,
      summary: {
        totalAssignments: assignments.length,
        gradedCount: gradedAssignments.length,
        averagePercentage: avgPct,
      },
    },
  };
}
