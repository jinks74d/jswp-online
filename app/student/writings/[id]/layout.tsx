/**
 * Outer layout for a single student writing. Loads the writing +
 * assignment + completed-step-keys once and renders the WritingShell
 * (back-link, header, sidebar). Children are step pages.
 *
 * Authorization:
 *   - requireRole('student') — gated upstream by /student/layout.tsx,
 *     re-applied here as belt-and-suspenders.
 *   - getWriting() returns null for writings the student isn't allowed
 *     to read (RLS handles it). 404 in that case.
 */

import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getWriting, getCompletedStepKeys } from "@/lib/queries/student-writings";
import { listFeedback } from "@/lib/queries/teacher-feedback";
import { getRubricScoresForWriting } from "@/lib/queries/rubric-scores";
import { listForStudentByMode } from "@/lib/queries/exemplars";
import { MODES, type JswpMode } from "@/lib/jswp-modes";
import { WritingShell } from "@/components/student/writing/writing-shell";
import { WritingModeProvider } from "@/components/student/writing/writing-mode-provider";

export const dynamic = "force-dynamic";

export default async function WritingLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const profile = await requireRole("student");
  const { id } = await params;

  const writing = await getWriting(id);
  if (!writing) {
    notFound();
  }

  const a = writing.assignment;
  const visibleSteps = MODES[a.mode as JswpMode].steps.filter((s) => {
    if (s.essayOnly && !a.is_essay) return false;
    if (s.requiresCounterargument && !a.has_counterargument) return false;
    if (s.requiresSourceText && !a.source_text) return false;
    return true;
  });

  const isReadOnly =
    writing.status === "submitted" || writing.status === "graded";

  // Fetch feedback for any returned writing so we can render the panel
  // and a banner count. Rubric scores load on graded writings to drive
  // the per-criterion breakdown. Exemplars load for the writing's mode
  // (RLS filters to published exemplars from the student's teachers).
  const [completedKeys, feedback, rubricScores, exemplars] = await Promise.all([
    getCompletedStepKeys(id),
    writing.status === "returned"
      ? listFeedback(id)
      : Promise.resolve([] as Awaited<ReturnType<typeof listFeedback>>),
    writing.status === "graded"
      ? getRubricScoresForWriting(id)
      : Promise.resolve(
          [] as Awaited<ReturnType<typeof getRubricScoresForWriting>>
        ),
    listForStudentByMode(a.mode as JswpMode),
  ]);

  return (
    <WritingModeProvider isReadOnly={isReadOnly}>
      <WritingShell
        writingId={id}
        currentUserId={profile.id}
        assignment={{
          id: a.id,
          title: a.title,
          mode: a.mode as JswpMode,
        }}
        steps={visibleSteps}
        currentStepKey={writing.current_step}
        completedKeys={completedKeys}
        status={writing.status}
        submittedAt={writing.submitted_at}
        gradedAt={writing.graded_at}
        totalScore={writing.total_score}
        feedback={feedback}
        rubricScores={rubricScores}
        exemplars={exemplars}
      >
        {children}
      </WritingShell>
    </WritingModeProvider>
  );
}
