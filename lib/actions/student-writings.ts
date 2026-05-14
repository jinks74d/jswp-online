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
  getSteps,
  getNextStep,
  getStepByKey,
  type JswpMode,
  type ChunkRatio,
} from "@/lib/jswp-modes";

/**
 * Click handler for the [Start Writing] / [Continue Writing] /
 * [Continue Revision] / [Review Submission] CTA on the assignment
 * detail page.
 *
 * For draft/in_progress/returned: routes to current_step.
 * For submitted/graded: routes to current_step (or first step) —
 *   the layout reads writing.status and renders read-only via the
 *   WritingModeProvider context. Same URL, different mode.
 */
export async function startWriting(assignmentId: string): Promise<void> {
  const profile = await requireRole("student");

  const result = await getOrCreateWriting(assignmentId, profile.id);
  if (!result) {
    throw new Error("Could not start writing — assignment not accessible.");
  }

  const { writing } = result;
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
      id, current_step, chunk_ratio,
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
    chunk_ratio: ChunkRatio;
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
  const visible = getSteps(a.mode, {
    isEssay: a.is_essay,
    hasCounterargument: a.has_counterargument,
    hasSourceText: !!a.source_text,
    chunkRatio: w.chunk_ratio,
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
  // Also returned → in_progress on first save during a revision (so
  // the teacher's view reflects "student picked up the feedback").
  const { error: statusErr } = await supabase
    .from("student_writings")
    .update({ status: "in_progress" })
    .eq("id", writingId)
    .in("status", ["draft", "returned"]);
  if (statusErr) {
    // Non-fatal: leave a log line but don't break the flow.
    console.error("markStepComplete status promote:", statusErr);
  }

  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/**
 * Submit a writing for teacher review. Called from the terminal step's
 * [Submit] button (final-draft for essays, paragraph-form for non-essays).
 *
 * Allowed source states: draft, in_progress, returned (per the
 * student_writings_student_update RLS policy). Any other state is a
 * no-op — RLS will reject the update and we'll fall through silently.
 *
 * On success, redirects to the assignment detail page where the CTA
 * now reads "Review Submission".
 */
export async function submitWriting(writingId: string): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { data: writing, error: wErr } = await supabase
    .from("student_writings")
    .select("id, assignment_id, status")
    .eq("id", writingId)
    .maybeSingle();

  if (wErr || !writing) {
    throw new Error(`Could not load writing ${writingId}`);
  }

  const { error: uErr } = await supabase
    .from("student_writings")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", writingId)
    .in("status", ["draft", "in_progress", "returned"]);

  if (uErr) {
    throw new Error(`Could not submit writing: ${uErr.message}`);
  }

  revalidatePath(`/student/writings/${writingId}`, "layout");
  revalidatePath(`/student/assignments/${writing.assignment_id}`);
  revalidatePath(`/student/assignments`);

  redirect(`/student/assignments/${writing.assignment_id}`);
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
      `id, chunk_ratio, assignment:assignment_id ( mode, is_essay, has_counterargument, source_text )`
    )
    .eq("id", writingId)
    .maybeSingle();

  if (wErr || !writing) {
    throw new Error(`Could not load writing ${writingId}`);
  }

  const w = writing as unknown as {
    chunk_ratio: ChunkRatio;
    assignment: {
      mode: JswpMode;
      is_essay: boolean;
      has_counterargument: boolean;
      source_text: string | null;
    };
  };
  const a = w.assignment;

  const visible = getSteps(a.mode, {
    isEssay: a.is_essay,
    hasCounterargument: a.has_counterargument,
    hasSourceText: !!a.source_text,
    chunkRatio: w.chunk_ratio,
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

/**
 * [Continue] handler for steps whose only completion side-effect is
 * marking step_progress + advancing — annotate-text and any future
 * step that has its own per-action save flow but no on-Continue
 * payload to persist. Real steps that need to save form fields on
 * Continue (decode-prompt) call savePromptDecoding + markStepComplete
 * directly instead.
 */
export async function completeStepAndAdvance(
  writingId: string,
  stepKey: string
): Promise<void> {
  await requireRole("student");
  await markStepComplete(writingId, stepKey);

  const supabase = await createServerClient();
  const { data: writing } = await supabase
    .from("student_writings")
    .select(
      `chunk_ratio, assignment:assignment_id ( mode, is_essay, has_counterargument, source_text )`
    )
    .eq("id", writingId)
    .maybeSingle();

  const w = writing as unknown as {
    chunk_ratio: ChunkRatio;
    assignment: {
      mode: JswpMode;
      is_essay: boolean;
      has_counterargument: boolean;
      source_text: string | null;
    };
  } | null;
  const a = w?.assignment;

  if (!w || !a) {
    throw new Error(`Could not resolve writing mode for ${writingId}`);
  }

  const visible = getSteps(a.mode, {
    isEssay: a.is_essay,
    hasCounterargument: a.has_counterargument,
    hasSourceText: !!a.source_text,
    chunkRatio: w.chunk_ratio,
  });

  const next = getNextStep(stepKey, visible);
  if (!next) {
    // Terminal step → submit the writing. submitWriting redirects to
    // /student/assignments/${assignmentId}. If the writing is already
    // in a non-submittable state (e.g. submitted/graded due to a stale
    // tab), the RLS-guarded UPDATE will no-op and the redirect lands
    // on the assignment page anyway.
    await submitWriting(writingId);
    return;
  }

  redirect(`/student/writings/${writingId}/${next.slug}`);
}
