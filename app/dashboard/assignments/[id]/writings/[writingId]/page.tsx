/**
 * /dashboard/assignments/[id]/writings/[writingId] — teacher review
 * surface for a single student writing.
 *
 * Layout:
 *   [back-link to submissions]   Student name · status badge   [Return] [Mark Graded]
 *   ─────────────────────────────────────────────────────────────────
 *   Left  (md:2/3): combined read-only view (every step's component
 *                   stacked top-to-bottom, wrapped in
 *                   <WritingModeProvider isReadOnly={true}>).
 *   Right (md:1/3): sticky <FeedbackPanel mode="teacher">.
 *
 * Mobile (< md): stacked, feedback panel at top. Polish ticket
 * tracks a drawer-based mobile experience (see docs/BACKLOG.md).
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
import { hasFinalDraftForPromotion } from "@/lib/queries/exemplars";
import { CombinedView } from "@/components/dashboard/writing-review/combined-view";
import { FeedbackPanel } from "@/components/dashboard/writing-review/feedback-panel";
import { ReviewActions } from "@/components/dashboard/writing-review/review-actions";
import { TeacherStatusBadge } from "@/components/dashboard/writing-review/teacher-status-badge";

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
  const unresolvedCount = feedback.filter((f) => !f.is_resolved).length;

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
            <span className="text-sm text-gray-700">
              Score: <span className="font-semibold">{writing.total_score}</span>
            </span>
          )}
        </div>
        <div className="text-sm text-gray-600">
          {writing.assignment.title}
        </div>
        <ReviewActions
          writingId={writing.id}
          status={writing.status}
          unresolvedCount={unresolvedCount}
          rubric={writing.assignment.rubric}
          hasFinalDraft={hasFinalDraft}
        />
      </header>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <CombinedView
            writingId={writing.id}
            mode={writing.assignment.mode}
            chunkRatio={writing.chunk_ratio}
            assignment={{
              prompt: writing.assignment.prompt,
              is_essay: writing.assignment.is_essay,
              has_counterargument: writing.assignment.has_counterargument,
              source_text: writing.assignment.source_text,
              source_title: writing.assignment.source_title,
              source_author: writing.assignment.source_author,
            }}
          />
        </div>

        <div className="md:sticky md:top-20 md:self-start">
          <FeedbackPanel
            writingId={writing.id}
            feedback={feedback}
            mode="teacher"
            currentUserId={profile.id}
          />
        </div>
      </div>
    </div>
  );
}
