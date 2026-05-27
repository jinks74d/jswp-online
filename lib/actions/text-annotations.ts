"use server";

/**
 * Mutations for the Read-and-Annotate step. RLS does the scoping —
 * auth_user_can_write_writing rejects writes from non-owners. The
 * actions don't hand-check student_id.
 *
 * Range columns are immutable: editing the kind/note is allowed,
 * editing range_start/range_end is not. To "move" a highlight, the
 * student deletes and re-creates.
 */

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type AnnotationKind = Database["public"]["Enums"]["jswp_annotation_kind"];

const VALID_KINDS = new Set<AnnotationKind>([
  "cd",
  "cm",
  "transition",
  "note",
  "main_idea",
]);

export interface CreateAnnotationInput {
  writingId: string;
  rangeStart: number;
  rangeEnd: number;
  selectedText: string;
  kind: AnnotationKind;
  note: string | null;
}

export async function createAnnotation(
  input: CreateAnnotationInput
): Promise<{ id: string }> {
  await requireRole("student");

  if (!VALID_KINDS.has(input.kind)) {
    throw new Error(`Invalid annotation kind: ${input.kind}`);
  }
  if (!Number.isInteger(input.rangeStart) || input.rangeStart < 0) {
    throw new Error("rangeStart must be a non-negative integer.");
  }
  if (!Number.isInteger(input.rangeEnd) || input.rangeEnd <= input.rangeStart) {
    throw new Error("rangeEnd must be greater than rangeStart.");
  }
  if (!input.selectedText || input.selectedText.length === 0) {
    throw new Error("selectedText is required.");
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("text_annotations")
    .insert({
      student_writing_id: input.writingId,
      range_start: input.rangeStart,
      range_end: input.rangeEnd,
      selected_text: input.selectedText,
      kind: input.kind,
      note: input.note?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Could not create annotation: ${error.message}`);
  }

  revalidatePath(`/student/writings/${input.writingId}`, "layout");
  return { id: data.id };
}

export interface UpdateAnnotationInput {
  annotationId: string;
  writingId: string; // for revalidation only
  kind: AnnotationKind;
  note: string | null;
}

export async function updateAnnotation(
  input: UpdateAnnotationInput
): Promise<void> {
  await requireRole("student");

  if (!VALID_KINDS.has(input.kind)) {
    throw new Error(`Invalid annotation kind: ${input.kind}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("text_annotations")
    .update({
      kind: input.kind,
      note: input.note?.trim() || null,
    })
    .eq("id", input.annotationId);

  if (error) {
    throw new Error(`Could not update annotation: ${error.message}`);
  }

  revalidatePath(`/student/writings/${input.writingId}`, "layout");
}

export async function deleteAnnotation(
  annotationId: string,
  writingId: string
): Promise<void> {
  await requireRole("student");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("text_annotations")
    .delete()
    .eq("id", annotationId);

  if (error) {
    throw new Error(`Could not delete annotation: ${error.message}`);
  }

  revalidatePath(`/student/writings/${writingId}`, "layout");
}
