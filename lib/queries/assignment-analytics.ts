/**
 * Per-assignment analytics (chunk 5.2).
 *
 * One read-only query helper. Fans out to three parallel small queries
 * (active enrollments, all writings on the assignment, rubric_scores
 * for those writings) and aggregates in JS. RLS scopes everything via
 * the existing policies — a teacher who can't read the assignment gets
 * the not_found branch; cross-tenant data never appears.
 *
 * Most-recent draft wins: when a student has multiple drafts on an
 * assignment, the draft with the highest draft_number determines which
 * bucket they appear in (submission rate, score stats, intervention).
 *
 * Score-distribution bucketing uses JSWP tier names (Exemplary,
 * Proficient, Developing, Beginning) against percentage of the rubric's
 * max possible score. For non-rubric assignments the max falls back to
 * the highest total_score observed among graded writings, with the
 * tiers still computed as fractions of that.
 */

import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { loadRubric } from "@/lib/rubric";
import type { Database } from "@/lib/database.types";

type WritingStatus = Database["public"]["Enums"]["jswp_writing_status"];

export interface StudentRef {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export interface ScoreTier {
  tier: "Exemplary" | "Proficient" | "Developing" | "Beginning";
  percentRange: readonly [number, number];
  count: number;
}

export interface AssignmentAnalytics {
  enrolledCount: number;
  formerWithSubmissions: number;

  submissionRate: {
    submitted: number;
    total: number;
    statusBreakdown: {
      notStarted: number;
      draft: number;
      inProgress: number;
      submitted: number;
      returned: number;
      graded: number;
    };
  };

  scoreStats: {
    count: number;
    mean: number | null;
    median: number | null;
    min: number | null;
    max: number | null;
    rubricMax: number | null;
    distribution: readonly ScoreTier[];
  };

  criterionBreakdown: ReadonlyArray<{
    criterionName: string;
    avgScore: number;
    maxScore: number;
    count: number;
    levelDistribution: ReadonlyArray<{ label: string; count: number }>;
  }>;

  hasRubric: boolean;

  interventionCandidates: {
    notSubmitted: readonly StudentRef[];
    awaitingGrading: readonly StudentRef[];
    belowThreshold: ReadonlyArray<{ student: StudentRef; score: number }>;
  };
}

export type AssignmentAnalyticsResult =
  | { state: "ok"; data: AssignmentAnalytics }
  | { state: "no_class_period" }
  | { state: "not_found" };

const TIERS: ReadonlyArray<{
  tier: ScoreTier["tier"];
  min: number; // inclusive
  max: number; // inclusive on top tier only
}> = [
  { tier: "Beginning", min: 0, max: 25 },
  { tier: "Developing", min: 25, max: 50 },
  { tier: "Proficient", min: 50, max: 75 },
  { tier: "Exemplary", min: 75, max: 100 },
];

const INTERVENTION_THRESHOLD_PCT = 50;

export async function getAssignmentAnalytics(
  assignmentId: string
): Promise<AssignmentAnalyticsResult> {
  const supabase = await createServerClient();

  const { data: assignment, error: aErr } = await supabase
    .from("assignments")
    .select("id, class_period_id, rubric")
    .eq("id", assignmentId)
    .maybeSingle();

  if (aErr) {
    console.error("getAssignmentAnalytics assignment:", aErr);
    return { state: "not_found" };
  }
  if (!assignment) return { state: "not_found" };

  if (!assignment.class_period_id) {
    return { state: "no_class_period" };
  }

  const rubric = loadRubric(assignment.rubric);
  const hasRubric = rubric.criteria.length > 0;
  const rubricMax = hasRubric
    ? rubric.criteria.reduce(
        (sum, c) =>
          sum +
          (c.levels.length > 0 ? Math.max(...c.levels.map((l) => l.score)) : 0),
        0
      )
    : null;

  const [enrollmentsRes, writingsRes, rubricScoresRes] = await Promise.all([
    supabase
      .from("class_student_enrollments")
      .select(
        `
        student_id,
        student:student_id ( id, first_name, last_name, email )
        `
      )
      .eq("class_period_id", assignment.class_period_id)
      .is("unenrolled_at", null),
    supabase
      .from("student_writings")
      .select(
        "id, student_id, draft_number, status, total_score, submitted_at"
      )
      .eq("assignment_id", assignmentId),
    supabase
      .from("rubric_scores")
      .select(
        `
        criterion_name, score, max_score, level_label,
        student_writing:student_writing_id!inner (
          id, assignment_id, status, student_id, draft_number
        )
        `
      )
      .eq("student_writing.assignment_id", assignmentId),
  ]);

  if (enrollmentsRes.error) {
    console.error("getAssignmentAnalytics enrollments:", enrollmentsRes.error);
    return { state: "not_found" };
  }
  if (writingsRes.error) {
    console.error("getAssignmentAnalytics writings:", writingsRes.error);
    return { state: "not_found" };
  }
  if (rubricScoresRes.error) {
    console.error("getAssignmentAnalytics rubric_scores:", rubricScoresRes.error);
    return { state: "not_found" };
  }

  type EnrollmentRow = {
    student_id: string;
    student: StudentRef | StudentRef[] | null;
  };
  type WritingRow = {
    id: string;
    student_id: string;
    draft_number: number;
    status: WritingStatus;
    total_score: number | null;
    submitted_at: string | null;
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
          status: WritingStatus;
          student_id: string;
          draft_number: number;
        }
      | Array<{
          id: string;
          assignment_id: string;
          status: WritingStatus;
          student_id: string;
          draft_number: number;
        }>
      | null;
  };

  const enrollmentRows = (enrollmentsRes.data ?? []) as unknown as EnrollmentRow[];
  const writingRows = (writingsRes.data ?? []) as unknown as WritingRow[];
  const rubricScoreRows = (rubricScoresRes.data ??
    []) as unknown as RubricScoreRow[];

  // ─── Build enrolled student map (id → profile) ──────────────────────
  const enrolledStudents = new Map<string, StudentRef>();
  for (const e of enrollmentRows) {
    const student = Array.isArray(e.student) ? e.student[0] : e.student;
    if (student) {
      enrolledStudents.set(e.student_id, student);
    }
  }

  // ─── Most-recent draft per student ──────────────────────────────────
  const latestByStudent = new Map<string, WritingRow>();
  for (const w of writingRows) {
    const current = latestByStudent.get(w.student_id);
    if (!current || w.draft_number > current.draft_number) {
      latestByStudent.set(w.student_id, w);
    }
  }

  // ─── Submission rate + status breakdown ─────────────────────────────
  const statusBreakdown = {
    notStarted: 0,
    draft: 0,
    inProgress: 0,
    submitted: 0,
    returned: 0,
    graded: 0,
  };

  let submittedOrLater = 0;
  for (const studentId of enrolledStudents.keys()) {
    const latest = latestByStudent.get(studentId);
    if (!latest) {
      statusBreakdown.notStarted += 1;
      continue;
    }
    switch (latest.status) {
      case "draft":
        statusBreakdown.draft += 1;
        break;
      case "in_progress":
        statusBreakdown.inProgress += 1;
        break;
      case "submitted":
        statusBreakdown.submitted += 1;
        submittedOrLater += 1;
        break;
      case "returned":
        statusBreakdown.returned += 1;
        submittedOrLater += 1;
        break;
      case "graded":
        statusBreakdown.graded += 1;
        submittedOrLater += 1;
        break;
    }
  }

  // ─── Former-with-submissions footnote count ─────────────────────────
  let formerWithSubmissions = 0;
  const seenFormerStudents = new Set<string>();
  for (const w of writingRows) {
    if (!enrolledStudents.has(w.student_id) && !seenFormerStudents.has(w.student_id)) {
      seenFormerStudents.add(w.student_id);
      // Only count if the student has any submitted/returned/graded writing
      if (
        w.status === "submitted" ||
        w.status === "returned" ||
        w.status === "graded"
      ) {
        formerWithSubmissions += 1;
      }
    }
  }

  // ─── Score stats: enrolled students, latest draft, graded only ──────
  const gradedScores: number[] = [];
  for (const studentId of enrolledStudents.keys()) {
    const latest = latestByStudent.get(studentId);
    if (
      latest &&
      latest.status === "graded" &&
      latest.total_score !== null &&
      Number.isFinite(Number(latest.total_score))
    ) {
      gradedScores.push(Number(latest.total_score));
    }
  }

  const sortedScores = [...gradedScores].sort((a, b) => a - b);
  const mean =
    sortedScores.length > 0
      ? sortedScores.reduce((s, v) => s + v, 0) / sortedScores.length
      : null;
  const median = computeMedian(sortedScores);
  const min = sortedScores.length > 0 ? sortedScores[0] : null;
  const max =
    sortedScores.length > 0 ? sortedScores[sortedScores.length - 1] : null;

  // Bucket max: rubric sum if rubric, else max observed score (fallback to 1
  // so we don't divide by zero; with no scores, distribution is all zeros).
  const bucketMax =
    rubricMax !== null && rubricMax > 0
      ? rubricMax
      : max !== null && max > 0
        ? max
        : 1;

  const distribution: ScoreTier[] = TIERS.map((t) => ({
    tier: t.tier,
    percentRange: [t.min, t.max] as const,
    count: 0,
  }));

  for (const s of sortedScores) {
    const pct = (s / bucketMax) * 100;
    const idx = pickTier(pct);
    distribution[idx].count += 1;
  }

  // ─── Criterion-weakness breakdown ───────────────────────────────────
  // Filter to rubric_scores that belong to graded latest-drafts of
  // currently-enrolled students. Snapshot fields drive grouping.
  type CriterionAgg = {
    criterionName: string;
    sumScore: number;
    sumMax: number;
    count: number;
    levels: Map<string, number>;
  };
  const criterionAggs = new Map<string, CriterionAgg>();

  for (const r of rubricScoreRows) {
    const sw = Array.isArray(r.student_writing)
      ? r.student_writing[0]
      : r.student_writing;
    if (!sw) continue;
    if (sw.status !== "graded") continue;
    if (!enrolledStudents.has(sw.student_id)) continue;
    const latest = latestByStudent.get(sw.student_id);
    if (!latest || latest.id !== sw.id) continue;

    const key = r.criterion_name;
    const agg = criterionAggs.get(key) ?? {
      criterionName: key,
      sumScore: 0,
      sumMax: 0,
      count: 0,
      levels: new Map<string, number>(),
    };
    agg.sumScore += Number(r.score);
    agg.sumMax += Number(r.max_score);
    agg.count += 1;
    if (r.level_label) {
      agg.levels.set(r.level_label, (agg.levels.get(r.level_label) ?? 0) + 1);
    }
    criterionAggs.set(key, agg);
  }

  const criterionBreakdown = Array.from(criterionAggs.values())
    .map((agg) => ({
      criterionName: agg.criterionName,
      avgScore: agg.count > 0 ? agg.sumScore / agg.count : 0,
      maxScore: agg.count > 0 ? agg.sumMax / agg.count : 0,
      count: agg.count,
      levelDistribution: Array.from(agg.levels.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => {
      // Weakest first by avg/max ratio.
      const aRatio = a.maxScore > 0 ? a.avgScore / a.maxScore : 0;
      const bRatio = b.maxScore > 0 ? b.avgScore / b.maxScore : 0;
      return aRatio - bRatio;
    });

  // ─── Intervention candidates ────────────────────────────────────────
  const notSubmitted: StudentRef[] = [];
  const awaitingGrading: StudentRef[] = [];
  const belowThreshold: { student: StudentRef; score: number }[] = [];

  for (const [studentId, profile] of enrolledStudents.entries()) {
    const latest = latestByStudent.get(studentId);
    if (
      !latest ||
      latest.status === "draft" ||
      latest.status === "in_progress"
    ) {
      notSubmitted.push(profile);
      continue;
    }
    if (latest.status === "submitted" || latest.status === "returned") {
      awaitingGrading.push(profile);
      continue;
    }
    if (latest.status === "graded") {
      const score = Number(latest.total_score ?? 0);
      const pct = bucketMax > 0 ? (score / bucketMax) * 100 : 0;
      if (pct < INTERVENTION_THRESHOLD_PCT) {
        belowThreshold.push({ student: profile, score });
      }
    }
  }

  const sortByName = (a: StudentRef, b: StudentRef) => {
    const an = `${a.last_name ?? ""} ${a.first_name ?? ""}`.trim().toLowerCase();
    const bn = `${b.last_name ?? ""} ${b.first_name ?? ""}`.trim().toLowerCase();
    return an.localeCompare(bn);
  };
  notSubmitted.sort(sortByName);
  awaitingGrading.sort(sortByName);
  belowThreshold.sort((a, b) => sortByName(a.student, b.student));

  return {
    state: "ok",
    data: {
      enrolledCount: enrolledStudents.size,
      formerWithSubmissions,
      submissionRate: {
        submitted: submittedOrLater,
        total: enrolledStudents.size,
        statusBreakdown,
      },
      scoreStats: {
        count: sortedScores.length,
        mean,
        median,
        min,
        max,
        rubricMax,
        distribution,
      },
      criterionBreakdown,
      hasRubric,
      interventionCandidates: {
        notSubmitted,
        awaitingGrading,
        belowThreshold,
      },
    },
  };
}

function computeMedian(sorted: readonly number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function pickTier(pct: number): number {
  // Lower-inclusive boundaries; 100% lands in Exemplary.
  if (pct >= 75) return 3; // Exemplary
  if (pct >= 50) return 2; // Proficient
  if (pct >= 25) return 1; // Developing
  return 0; // Beginning
}
