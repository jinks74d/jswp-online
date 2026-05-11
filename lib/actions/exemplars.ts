"use server";

/**
 * Exemplar mutations (chunk 6.1).
 *
 * createExemplar / updateExemplar drive the authoring form via
 * useActionState. togglePublish + deleteExemplar are simple button
 * actions invoked from the edit page.
 *
 * RLS gates all writes via exemplars_owner_all (created_by =
 * auth.uid()). The actions add a defense-in-depth role gate up
 * front so we get a clean error before hitting RLS.
 *
 * full_text max length: 20,000 chars. Typical JSWP exemplar is well
 * under that; the cap exists to keep the textarea performant and
 * shut down accidental paste-of-novel.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { EXEMPLAR_TEXT_MAX } from "@/lib/exemplar-limits";
import type { Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];

const TEACHER_ROLES: (
  | "teacher"
  | "school_admin"
  | "district_admin"
  | "super_admin"
)[] = ["teacher", "school_admin", "district_admin", "super_admin"];

const VALID_MODES: ReadonlyArray<Mode> = [
  "expository",
  "argumentation",
  "literary",
  "narrative",
];

export type ExemplarFormState = {
  error?: string;
  fieldErrors?: {
    title?: string;
    mode?: string;
    full_text?: string;
  };
};

interface ParsedFields {
  title: string;
  description: string | null;
  mode: Mode;
  full_text: string;
  is_published: boolean;
  shared_with_school: boolean;
}

type ParseResult =
  | { ok: true; fields: ParsedFields }
  | { ok: false; state: ExemplarFormState };

function parseForm(formData: FormData): ParseResult {
  const title = String(formData.get("title") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const mode = String(formData.get("mode") ?? "") as Mode;
  const full_text = String(formData.get("full_text") ?? "");
  const is_published = formData.get("is_published") === "on";
  const shared_with_school = formData.get("shared_with_school") === "on";

  const fieldErrors: ExemplarFormState["fieldErrors"] = {};
  if (!title) {
    fieldErrors.title = "Title is required.";
  } else if (title.length > 255) {
    fieldErrors.title = "Title must be 255 characters or fewer.";
  }
  if (!VALID_MODES.includes(mode)) {
    fieldErrors.mode = "Pick a valid mode.";
  }
  if (!full_text.trim()) {
    fieldErrors.full_text = "Exemplar text is required.";
  } else if (full_text.length > EXEMPLAR_TEXT_MAX) {
    fieldErrors.full_text = `Exemplar text must be ${EXEMPLAR_TEXT_MAX.toLocaleString()} characters or fewer (currently ${full_text.length.toLocaleString()}).`;
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, state: { fieldErrors } };
  }

  return {
    ok: true,
    fields: {
      title,
      description: descriptionRaw ? descriptionRaw : null,
      mode,
      full_text,
      is_published,
      shared_with_school,
    },
  };
}

export async function createExemplar(
  _prev: ExemplarFormState,
  formData: FormData
): Promise<ExemplarFormState> {
  const profile = await requireRole(TEACHER_ROLES);

  if (!profile.school_id) {
    return { error: "Your profile isn't attached to a school yet." };
  }

  const parsed = parseForm(formData);
  if (!parsed.ok) return parsed.state;
  const { fields } = parsed;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("exemplars")
    .insert({
      district_id: profile.district_id,
      school_id: profile.school_id,
      created_by: profile.id,
      title: fields.title,
      description: fields.description,
      mode: fields.mode,
      full_text: fields.full_text,
      is_published: fields.is_published,
      shared_with_school: fields.shared_with_school,
    })
    .select("id")
    .single();

  if (error) {
    return { error: `Could not save exemplar: ${error.message}` };
  }

  revalidatePath("/dashboard/exemplars");
  redirect(`/dashboard/exemplars/${data.id}`);
}

export async function updateExemplar(
  exemplarId: string,
  _prev: ExemplarFormState,
  formData: FormData
): Promise<ExemplarFormState> {
  const profile = await requireRole(TEACHER_ROLES);

  const parsed = parseForm(formData);
  if (!parsed.ok) return parsed.state;
  const { fields } = parsed;

  const supabase = await createServerClient();

  // Defense in depth: reject updates by non-authors with a clean
  // message before relying on RLS to silently no-op. RLS's
  // exemplars_owner_all WITH CHECK requires created_by = auth.uid()
  // so the row update would otherwise return zero rows affected
  // without an error.
  const { data: existing, error: fetchErr } = await supabase
    .from("exemplars")
    .select("created_by")
    .eq("id", exemplarId)
    .maybeSingle();
  if (fetchErr) {
    return { error: `Could not load exemplar: ${fetchErr.message}` };
  }
  if (!existing) {
    return { error: "Exemplar not found." };
  }
  if (existing.created_by !== profile.id) {
    return {
      error:
        "You can only edit exemplars you authored. Ask the author to make changes.",
    };
  }

  const { error } = await supabase
    .from("exemplars")
    .update({
      title: fields.title,
      description: fields.description,
      mode: fields.mode,
      full_text: fields.full_text,
      is_published: fields.is_published,
      shared_with_school: fields.shared_with_school,
    })
    .eq("id", exemplarId);

  if (error) {
    return { error: `Could not save exemplar: ${error.message}` };
  }

  revalidatePath("/dashboard/exemplars");
  revalidatePath(`/dashboard/exemplars/${exemplarId}`);
  return {};
}

export async function togglePublish(
  exemplarId: string,
  nextPublished: boolean
): Promise<void> {
  await requireRole(TEACHER_ROLES);
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("exemplars")
    .update({ is_published: nextPublished })
    .eq("id", exemplarId);
  if (error) {
    throw new Error(`Could not change publish state: ${error.message}`);
  }
  revalidatePath("/dashboard/exemplars");
  revalidatePath(`/dashboard/exemplars/${exemplarId}`);
}

export async function deleteExemplar(exemplarId: string): Promise<void> {
  await requireRole(TEACHER_ROLES);
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("exemplars")
    .delete()
    .eq("id", exemplarId);
  if (error) {
    throw new Error(`Could not delete exemplar: ${error.message}`);
  }
  revalidatePath("/dashboard/exemplars");
  redirect("/dashboard/exemplars");
}
