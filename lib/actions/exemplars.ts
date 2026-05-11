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
import {
  EXEMPLAR_TEXT_MAX,
  validateStepTags,
  type StepTag,
} from "@/lib/exemplar-limits";
import {
  sanitizeExemplarHtml,
  htmlToPlainText,
} from "@/lib/exemplar-content";
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
    step_tags?: string;
    content_format?: string;
  };
};

interface ParsedFields {
  title: string;
  description: string | null;
  mode: Mode;
  full_text: string;
  is_published: boolean;
  shared_with_school: boolean;
  /** Normalized: empty arrays collapse to null at the action layer so
   * the DB column stays NULL = "untagged / mode-default." */
  step_tags: StepTag[] | null;
  /** 'plain' or 'html'. When 'html', full_text has already been
   * sanitized by parseForm. */
  content_format: "plain" | "html";
}

type ParseResult =
  | { ok: true; fields: ParsedFields }
  | { ok: false; state: ExemplarFormState };

function parseForm(formData: FormData): ParseResult {
  const title = String(formData.get("title") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const mode = String(formData.get("mode") ?? "") as Mode;
  const fullTextRaw = String(formData.get("full_text") ?? "");
  const is_published = formData.get("is_published") === "on";
  const shared_with_school = formData.get("shared_with_school") === "on";
  const contentFormatRaw = String(formData.get("content_format") ?? "plain");
  const content_format: "plain" | "html" =
    contentFormatRaw === "html" ? "html" : "plain";
  const stepTagsRaw = formData
    .getAll("step_tags")
    .map((v) => (typeof v === "string" ? v : ""))
    .filter(Boolean);

  const fieldErrors: ExemplarFormState["fieldErrors"] = {};
  if (!title) {
    fieldErrors.title = "Title is required.";
  } else if (title.length > 255) {
    fieldErrors.title = "Title must be 255 characters or fewer.";
  }
  if (!VALID_MODES.includes(mode)) {
    fieldErrors.mode = "Pick a valid mode.";
  }

  // Format-specific content handling. For 'html', sanitize via
  // DOMPurify + the JSWP class allowlist; if anything was stripped,
  // refuse the save so the teacher reviews. For 'plain', the
  // existing length + empty-text checks apply.
  let full_text = fullTextRaw;
  if (content_format === "html") {
    const result = sanitizeExemplarHtml(fullTextRaw);
    if (result.removedAny) {
      fieldErrors.full_text =
        "Invalid markup detected. The save was blocked so you can review.";
    } else {
      full_text = result.sanitized;
      const plain = htmlToPlainText(result.sanitized);
      if (!plain) {
        fieldErrors.full_text = "Exemplar text is required.";
      } else if (full_text.length > EXEMPLAR_TEXT_MAX) {
        fieldErrors.full_text = `Exemplar markup must be ${EXEMPLAR_TEXT_MAX.toLocaleString()} characters or fewer (currently ${full_text.length.toLocaleString()}, including markup).`;
      }
    }
  } else {
    if (!fullTextRaw.trim()) {
      fieldErrors.full_text = "Exemplar text is required.";
    } else if (fullTextRaw.length > EXEMPLAR_TEXT_MAX) {
      fieldErrors.full_text = `Exemplar text must be ${EXEMPLAR_TEXT_MAX.toLocaleString()} characters or fewer (currently ${fullTextRaw.length.toLocaleString()}).`;
    }
  }

  const stepValidation = validateStepTags(stepTagsRaw);
  if (!stepValidation.ok) {
    fieldErrors.step_tags = stepValidation.error;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, state: { fieldErrors } };
  }

  const tags = stepValidation.ok ? stepValidation.tags : [];

  return {
    ok: true,
    fields: {
      title,
      description: descriptionRaw ? descriptionRaw : null,
      mode,
      full_text,
      is_published,
      shared_with_school,
      step_tags: tags.length > 0 ? tags : null,
      content_format,
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
      step_tags: fields.step_tags,
      content_format: fields.content_format,
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
      step_tags: fields.step_tags,
      content_format: fields.content_format,
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
