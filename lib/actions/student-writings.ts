"use server";

/**
 * Mutations for the student writing flow. RLS does the scoping; the
 * actions don't hand-check student_id. Any unauthorized call will get
 * a Postgres error rather than a silent succeed.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { getOrCreateWriting } from "@/lib/queries/student-writings";
import {
  MODES,
  getNextStep,
  getStepByKey,
  type JswpMode,
} from "@/lib/jswp-modes";

/**
 * Click handler for the [Start Writing] / [Continue Writing] /
 * [Continue Revision] CTA on the assignment detail page.
 *
 * Routes the student into the step engine. For submitted/graded
 * writings the action is a no-op — read-only review is chunk 4.6.
 */
export async function startWriting(assignmentId: string): Promise<void> {
  const profile = await requireRole("student");

  const result = await getOrCreateWriting(assignmentId, profile.id);
  if (!result) {
    throw new Error("Could not start writing — assignment not accessible.");
  }

  const { writing } = result;

  // Submitted / graded writings are locked. Read-only review lands later.
  if (writing.status === "submitted" || writing.status === "graded") {
    return;
  }

  const mode = result.assignment.mode as JswpMode;
  const resolvedKey = writing.current_step ?? MODES[mode].steps[0]?.key;
  const step = resolvedKey ? getStepByKey(resolvedKey) : undefined;
  if (!step) {
    throw new Error(`Step not found for key: ${resolvedKey}`);
  }

  redirect(`/student/writings/${writing.id}/${step.slug}`);
}

/**
 * Mark a step complete + advance current_step to the next step. Idempotent:
 * re-completing is a no-op. Used by every real step when the student clicks
 * [Continue].
 */
export async function markStepComplete(
  writingId: string,
  stepKey: string
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  // 1. Look up the writing (for mode + assignment context to compute next step).
  const { data: writing, error: wErr } = await supabase
    .from("student_writings")
    .select(
      `
      id, current_step,
      assignment:assignment_id ( mode, is_essay, has_counterargument, source_text )
      `
    )
    .eq("id", writingId)
    .maybeSingle();

  if (wErr || !writing) {
    throw new Error(`Could not load writing ${writingId}`);
  }

  // Supabase's generated types don't infer the embed shape here —
  // narrow once and reuse.
  type WritingShape = {
    id: string;
    current_step: string | null;
    assignment: {
      mode: JswpMode;
      is_essay: boolean;
      has_counterargument: boolean;
      source_text: string | null;
    };
  };
  const w = writing as unknown as WritingShape;
  const a = w.assignment;

  // 2. Upsert step_progress for this step.
  const nowIso = new Date().toISOString();
  const { error: spErr } = await supabase
    .from("step_progress")
    .upsert(
      {
        student_writing_id: writingId,
        step_key: stepKey,
        started_at: nowIso, // idempotent: ON CONFLICT, keep existing row's started_at via merge
        completed_at: nowIso,
      },
      { onConflict: "student_writing_id,step_key" }
    );

  if (spErr) {
    throw new Error(`Could not mark step complete: ${spErr.message}`);
  }

  // 3. Advance current_step to next step in the visible sequence.
  const visible = MODES[a.mode].steps.filter((s) => {
    if (s.essayOnly && !a.is_essay) return false;
    if (s.requiresCounterargument && !a.has_counterargument) return false;
    if (s.requiresSourceText && !a.source_text) return false;
    return true;
  });
  const next = getNextStep(stepKey, visible);

  // If this completed step is later than current_step (rare; revisiting
  // and re-completing), don't move current_step backwards.
  const newCurrent = next ? next.key : stepKey;
  const currentIdx = visible.findIndex((s) => s.key === w.current_step);
  const newCurrentIdx = visible.findIndex((s) => s.key === newCurrent);

  if (newCurrentIdx > currentIdx) {
    const { error: uErr } = await supabase
      .from("student_writings")
      .update({ current_step: newCurrent })
      .eq("id", writingId);
    if (uErr) {
      throw new Error(`Could not advance current_step: ${uErr.message}`);
    }
  }

  // Promote draft → in_progress on first completion.
  const { error: statusErr } = await supabase
    .from("student_writings")
    .update({ status: "in_progress" })
    .eq("id", writingId)
    .eq("status", "draft");
  if (statusErr) {
    // Non-fatal: leave a log line but don't break the flow.
    console.error("markStepComplete status promote:", statusErr);
  }

  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/**
 * Set current_step to a specific step. Used when the student clicks a
 * previously-completed step in the sidebar to revisit it. Doesn't write
 * step_progress — completion stays sticky.
 */
export async function navigateToStep(
  writingId: string,
  stepKey: string
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("student_writings")
    .update({ current_step: stepKey })
    .eq("id", writingId);

  if (error) {
    throw new Error(`Could not navigate to step: ${error.message}`);
  }

  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/**
 * Used by the placeholder step's [Continue] button — advances current_step
 * to the next visible step WITHOUT writing step_progress. The placeholder
 * doesn't represent real completed work, just a route-able stub.
 */
export async function advanceCurrentStep(
  writingId: string,
  fromStepKey: string
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { data: writing, error: wErr } = await supabase
    .from("student_writings")
    .select(
      `id, assignment:assignment_id ( mode, is_essay, has_counterargument, source_text )`
    )
    .eq("id", writingId)
    .maybeSingle();

  if (wErr || !writing) {
    throw new Error(`Could not load writing ${writingId}`);
  }

  const a = (writing as unknown as {
    assignment: {
      mode: JswpMode;
      is_essay: boolean;
      has_counterargument: boolean;
      source_text: string | null;
    };
  }).assignment;

  const visible = MODES[a.mode].steps.filter((s) => {
    if (s.essayOnly && !a.is_essay) return false;
    if (s.requiresCounterargument && !a.has_counterargument) return false;
    if (s.requiresSourceText && !a.source_text) return false;
    return true;
  });
  const next = getNextStep(fromStepKey, visible);
  if (!next) {
    // Already at the last step — nothing to do.
    return;
  }

  const { error } = await supabase
    .from("student_writings")
    .update({ current_step: next.key })
    .eq("id", writingId);
  if (error) {
    throw new Error(`Could not advance step: ${error.message}`);
  }

  revalidatePath(`/student/writings/${writingId}`, "layout");
  redirect(`/student/writings/${writingId}/${next.slug}`);
}
