/**
 * /dashboard/assignments/[id]/writings/[writingId] — teacher review
 * surface for a single student writing.
 *
 * Layout (single column):
 *   [back-link to submissions]   Student name · status badge   [Return] [Mark Graded]
 *   ─────────────────────────────────────────────────────────────────
 *   Combined read-only view — every step stacked top-to-bottom, each
 *   step followed by a SectionFeedbackNote textarea (per-section
 *   teacher feedback), wrapped in <WritingModeProvider isReadOnly>.
 *   ─────────────────────────────────────────────────────────────────
 *   "Overall feedback" heading + threaded <FeedbackPanel mode="teacher">.
 *
 * RLS scopes everything via getWritingForTeacherReview — the page
 * notFound()s for writings the teacher can't see.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getWritingForTeacherReview } from "@/lib/queries/teacher-writings";
import { listFeedback } from "@/lib/queries/teacher-feedback";
import { groupSectionFeedback } from "@/lib/section-feedback";
import { hasFinalDraftForPromotion } from "@/lib/queries/exemplars";
import { CombinedView } from "@/components/dashboard/writing-review/combined-view";
import { FeedbackPanel } from "@/components/dashboard/writing-review/feedback-panel";
import { ReviewActions } from "@/components/dashboard/writing-review/review-actions";
import { TeacherStatusBadge } from "@/components/dashboard/writing-review/teacher-status-badge";
import { GradeFormatBar } from "@/components/dashboard/writing-review/grade-format-bar";
import { OverallGradeControl } from "@/components/dashboard/writing-review/overall-grade-control";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string; writingId: string }>;

export default async function TeacherWritingReviewPage({
  params,
}: {
  params: Params;
}) {
  const profile = await requireRole(["teacher", "school_admin", "district_admin", "super_admin"]);
  const { id: assignmentId, writingId } = await params;

  const writing = await getWritingForTeacherReview(writingId);
  if (!writing || writing.assignment_id !== assignmentId) {
    notFound();
  }

  const [feedback, hasFinalDraft] = await Promise.all([
    listFeedback(writingId),
    hasFinalDraftForPromotion(writingId),
  ]);
  const { byStep: feedbackByStep, overall: overallFeedback } =
    groupSectionFeedback(feedback);

  const studentName =
    [writing.student.first_name, writing.student.last_name]
      .filter(Boolean)
      .join(" ") ||
    writing.student.email ||
    "—";

  return (
    <div className="space-y-5">
      <Link
        href={`/dashboard/assignments/${assignmentId}/writings`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to submissions
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{studentName}</h1>
          <TeacherStatusBadge status={writing.status} />
          {writing.status === "graded" && writing.total_score !== null && (
            <span className="text-sm text-stone-700">
              Score: <span className="font-semibold">{writing.total_score}</span>
            </span>
          )}
        </div>
        <div className="text-sm text-stone-600">
          {writing.assignment.title}
        </div>
        <ReviewActions
          writingId={writing.id}
          status={writing.status}
          rubric={writing.assignment.rubric}
          hasFinalDraft={hasFinalDraft}
        />
      </header>

      <div className="space-y-8">
        <GradeFormatBar writingId={writing.id} format={writing.grade_format} />

        <CombinedView
          writingId={writing.id}
          mode={writing.assignment.mode}
          chunkRatio={writing.chunk_ratio}
          feedbackByStep={feedbackByStep}
          gradeFormat={writing.grade_format}
          assignment={{
            prompt: writing.assignment.prompt,
            is_essay: writing.assignment.is_essay,
            has_counterargument: writing.assignment.has_counterargument,
            source_text: writing.assignment.source_text,
            source_title: writing.assignment.source_title,
            source_author: writing.assignment.source_author,
            source_file_path: writing.assignment.source_file_path,
            source_file_name: writing.assignment.source_file_name,
          }}
        />

        <section
          aria-labelledby="overall-feedback-heading"
          className="border-t border-stone-200 pt-6"
        >
          <h2
            id="overall-feedback-heading"
            className="mb-3 text-lg font-semibold text-gray-900"
          >
            Overall feedback
          </h2>
          <OverallGradeControl
            writingId={writing.id}
            format={writing.grade_format}
            value={writing.overall_grade ?? ""}
          />
          <FeedbackPanel
            writingId={writing.id}
            feedback={overallFeedback}
            mode="teacher"
            currentUserId={profile.id}
          />
        </section>
      </div>
    </div>
  );
}
