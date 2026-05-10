"use server";

/**
 * Mutations for the Gather-CDs step. RLS does the scoping —
 * candidate_cds_write chains via gathering_cds_sheets →
 * auth_user_can_write_writing.
 *
 * argumentation_side is left as NULL by all of these actions in
 * chunk 4.5. The Argumentation topic_sentence_dev step (chunk 4.5a)
 * will write that column.
 */

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

/* ─── Bootstrap: idempotent per-BP gathering_cds_sheets ────────────── */

/**
 * Creates one sheet per body_paragraph_position, 1..num_body_paragraphs.
 * Race-safe via UNIQUE (student_writing_id, body_paragraph_position) +
 * ignoreDuplicates upsert. Sheets are intentionally empty on creation
 * — students click [Add candidate] when ready (no starter rows).
 */
export async function bootstrapGatheringSheets(
  writingId: string
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { data: writing, error: wErr } = await supabase
    .from("student_writings")
    .select(`status, assignment:assignment_id ( num_body_paragraphs )`)
    .eq("id", writingId)
    .maybeSingle();
  if (wErr || !writing) {
    throw new Error(`Could not load writing ${writingId}`);
  }
  const w = writing as unknown as {
    status: "draft" | "in_progress" | "submitted" | "returned" | "graded";
    assignment: { num_body_paragraphs: number };
  };

  // Read-only states: skip bootstrap. RLS would reject the upserts.
  if (w.status === "submitted" || w.status === "graded") {
    return;
  }
  const num = w.assignment.num_body_paragraphs;

  const rows = Array.from({ length: num }, (_, i) => ({
    student_writing_id: writingId,
    body_paragraph_position: i + 1,
  }));

  const { error } = await supabase
    .from("gathering_cds_sheets")
    .upsert(rows, {
      onConflict: "student_writing_id,body_paragraph_position",
      ignoreDuplicates: true,
    });

  if (error) {
    throw new Error(`bootstrapGatheringSheets: ${error.message}`);
  }
  // No revalidatePath: this is called from RSC render in
  // gather-cds-step.tsx and topic-sentence-dev-step.tsx, both with
  // dynamic = "force-dynamic". Calling revalidatePath during render
  // is unsupported in Next.js 15.5+ (it errors). The other mutations
  // in this file (createCandidate, etc.) DO call revalidatePath
  // because they're invoked from form actions on the client side.
}

/* ─── Sheet field updates ──────────────────────────────────────────── */

export async function updateSheetTaskPortion(
  writingId: string,
  sheetId: string,
  taskPortion: string
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("gathering_cds_sheets")
    .update({ task_portion: taskPortion.trim() || null })
    .eq("id", sheetId);

  if (error) {
    throw new Error(`updateSheetTaskPortion: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/* ─── Candidate CRUD ───────────────────────────────────────────────── */

export async function createCandidate(
  writingId: string,
  sheetId: string
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  // Concurrent [Add candidate] clicks can both read the same max(position)
  // and one INSERT will trip the UNIQUE (gathering_sheet_id, position)
  // constraint with 23505. On that error, refetch and retry.
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { data: existing, error: exErr } = await supabase
      .from("candidate_cds")
      .select("position")
      .eq("gathering_sheet_id", sheetId)
      .order("position", { ascending: false })
      .limit(1);
    if (exErr) {
      throw new Error(`createCandidate fetch: ${exErr.message}`);
    }
    const nextPos = (existing?.[0]?.position ?? 0) + 1;

    const { error } = await supabase.from("candidate_cds").insert({
      gathering_sheet_id: sheetId,
      position: nextPos,
      text: "",
      is_selected: false,
    });
    if (!error) {
      revalidatePath(`/student/writings/${writingId}`, "layout");
      return;
    }
    if (error.code !== "23505" || attempt === MAX_ATTEMPTS) {
      throw new Error(`createCandidate: ${error.message}`);
    }
  }
}

export async function updateCandidateText(
  writingId: string,
  candidateId: string,
  text: string
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("candidate_cds")
    .update({ text })
    .eq("id", candidateId);
  if (error) {
    throw new Error(`updateCandidateText: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/**
 * Toggle a candidate's is_selected flag. When selecting, assign the
 * next selection_order on this sheet (max + 1) so the promotion logic
 * in writing-structure.bootstrapWritingStructure can iterate them
 * in priority order.
 * When deselecting, clear selection_order.
 *
 * Per the chunk 4.5 contract: deselecting does NOT delete an already-
 * promoted concrete_detail. Students manage that side via the t-chart
 * UI. The candidate_cds row stays for the audit trail.
 */
export async function setCandidateSelected(
  writingId: string,
  candidateId: string,
  selected: boolean
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  if (!selected) {
    const { error } = await supabase
      .from("candidate_cds")
      .update({ is_selected: false, selection_order: null })
      .eq("id", candidateId);
    if (error) throw new Error(`setCandidateSelected: ${error.message}`);
    revalidatePath(`/student/writings/${writingId}`, "layout");
    return;
  }

  // Need to know the sheet so we can compute next selection_order.
  const { data: candidate, error: cErr } = await supabase
    .from("candidate_cds")
    .select("gathering_sheet_id")
    .eq("id", candidateId)
    .maybeSingle();
  if (cErr || !candidate) {
    throw new Error(`setCandidateSelected lookup: ${cErr?.message ?? "no row"}`);
  }

  const { data: peers, error: pErr } = await supabase
    .from("candidate_cds")
    .select("selection_order")
    .eq("gathering_sheet_id", candidate.gathering_sheet_id)
    .not("selection_order", "is", null)
    .order("selection_order", { ascending: false })
    .limit(1);
  if (pErr) {
    throw new Error(`setCandidateSelected peers: ${pErr.message}`);
  }
  const nextOrder = (peers?.[0]?.selection_order ?? 0) + 1;

  const { error } = await supabase
    .from("candidate_cds")
    .update({ is_selected: true, selection_order: nextOrder })
    .eq("id", candidateId);
  if (error) {
    throw new Error(`setCandidateSelected: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

/**
 * Tag a candidate's argumentation side for the topic-sentence-development
 * step (chunk 4.5a). Argumentation-only column; no schema enforcement
 * that callers be on argumentation assignments — RLS scopes to the
 * student's own writing, and the column has CHECK constraints on the
 * enum values + NULL.
 *
 * Pass null to clear the tag.
 */
export async function setCandidateSide(
  writingId: string,
  candidateId: string,
  side: "pro" | "con" | "neutral" | null
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("candidate_cds")
    .update({ argumentation_side: side })
    .eq("id", candidateId);
  if (error) {
    throw new Error(`setCandidateSide: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}

export async function deleteCandidate(
  writingId: string,
  candidateId: string
): Promise<void> {
  await requireRole("student");
  const supabase = await createServerClient();

  // Note: existing concrete_details with candidate_cd_id pointing here
  // will have candidate_cd_id SET NULL automatically (per FK definition
  // in schema). Promoted CDs stay intact; only the trace-back link is
  // severed. Same philosophy as deselection — never silently remove
  // student work.
  const { error } = await supabase
    .from("candidate_cds")
    .delete()
    .eq("id", candidateId);
  if (error) {
    throw new Error(`deleteCandidate: ${error.message}`);
  }
  revalidatePath(`/student/writings/${writingId}`, "layout");
}
