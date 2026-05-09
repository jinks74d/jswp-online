/**
 * Bare /student/writings/[id] redirects to the writing's current step.
 * Direct entry into a writing always lands you wherever you left off.
 */

import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getWriting } from "@/lib/queries/student-writings";
import { MODES, getStepByKey, type JswpMode } from "@/lib/jswp-modes";

export const dynamic = "force-dynamic";

export default async function WritingIndex({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("student");
  const { id } = await params;

  const writing = await getWriting(id);
  if (!writing) notFound();

  const stepKey =
    writing.current_step ??
    MODES[writing.assignment.mode as JswpMode].steps[0]?.key;

  const step = stepKey ? getStepByKey(stepKey) : undefined;
  if (!step) notFound();

  redirect(`/student/writings/${id}/${step.slug}`);
}
