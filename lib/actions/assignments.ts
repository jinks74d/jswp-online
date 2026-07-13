/**
 * Server actions for assignment authoring. All actions enforce
 * teacher-only access at the layer (admins reviewing the teacher
 * dashboard can navigate but not create). district_id, school_id,
 * teacher_id are derived from the calling profile — never accepted
 * from the form.
 *
 * "Published" is encoded by released_at being non-null. There is no
 * status column.
 */

"use server";

import "server-only";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateRubric, emptyRubric } from "@/lib/rubric";
import { sanitizeSourceHtml, sourceHtmlToSubstrate } from "@/lib/source-content";
import type { Database, Json } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];
type ChunkRatio = Database["public"]["Enums"]["jswp_chunk_ratio"];

const VALID_MODES = new Set<Mode>([
  "expository",
  "argumentation",
  "literary",
  "narrative",
]);
const VALID_RATIOS = new Set<ChunkRatio>([
  "lit_one_to_two_plus",
  "lit_three_plus_to_zero",
  "nar_two_plus_to_one",
  "nonlit_summary_three_plus_to_zero",
  "nonlit_expository_two_plus_to_one",
  "nonlit_argumentation_two_plus_to_one",
]);

export type AssignmentFormState = {
  error?: string;
  fieldErrors?: {
    title?: string;
    prompt?: string;
    num_body_paragraphs?: string;
    default_chunks_per_bp?: string;
    rubric?: string;
  };
  success?: string;
};

/* ─── Helpers ────────────────────────────────────────────────────────── */

function parseTimestamp(raw: string): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function emptyToNull(s: string): string | null {
  const v = s.trim();
  return v === "" ? null : v;
}

function parseCommonFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  const isEssay =
    formData.get("is_essay") === "on" || formData.get("is_essay") === "true";
  const numBodyParagraphsRaw = formData.get("num_body_paragraphs");
  const numBodyParagraphs = numBodyParagraphsRaw
    ? Number(numBodyParagraphsRaw)
    : 1;
  const defaultChunksPerBpRaw = formData.get("default_chunks_per_bp");
  const defaultChunksPerBp = defaultChunksPerBpRaw
    ? Number(defaultChunksPerBpRaw)
    : 1;
  const chunkRatioRaw = String(
    formData.get("default_chunk_ratio") ?? "nonlit_expository_two_plus_to_one"
  );
  const hasCounterargument =
    formData.get("has_counterargument") === "on" ||
    formData.get("has_counterargument") === "true";
  const dueAt = parseTimestamp(String(formData.get("due_at") ?? ""));
  const classPeriodIdRaw = String(formData.get("class_period_id") ?? "");
  const classPeriodId = classPeriodIdRaw === "" ? null : classPeriodIdRaw;

  // Source text fields — Narrative mode form omits them entirely; the
  // action coerces missing/empty values to null. Explicit empty-to-null
  // conversion so accidental whitespace doesn't pollute the column.
  const sourceText = emptyToNull(String(formData.get("source_text") ?? ""));
  // Untrimmed variant for the PDF substrate: source_text MUST equal the
  // pdf.js buildPdfText() output byte-for-byte, because annotation offsets are
  // created against that exact string at render. Trimming (as emptyToNull does)
  // would shift every offset if the first/last item carried whitespace. Only
  // empty→null is applied; the characters are otherwise preserved.
  const sourceTextRawVal = String(formData.get("source_text") ?? "");
  const sourceTextRaw =
    sourceTextRawVal.trim() === "" ? null : sourceTextRawVal;
  const sourceTitle = emptyToNull(String(formData.get("source_title") ?? ""));
  const sourceAuthor = emptyToNull(String(formData.get("source_author") ?? ""));
  const sourceCitation = emptyToNull(
    String(formData.get("source_citation") ?? "")
  );
  const sourceUrl = emptyToNull(String(formData.get("source_url") ?? ""));

  // Rich / PDF-native source fields (Chunk 1). source_html is the candidate
  // rich body; source_render_mode + source_file_* describe how it renders and
  // where the original lives. Sanitization + substrate derivation happen in
  // buildSourceColumns — never trust posted HTML or client source_text for
  // rich content.
  const sourceHtml = emptyToNull(String(formData.get("source_html") ?? ""));
  const sourceRenderModeRaw = String(
    formData.get("source_render_mode") ?? ""
  );
  const sourceFilePath = emptyToNull(
    String(formData.get("source_file_path") ?? "")
  );
  const sourceFileName = emptyToNull(
    String(formData.get("source_file_name") ?? "")
  );
  const sourceFileMime = emptyToNull(
    String(formData.get("source_file_mime") ?? "")
  );

  return {
    title,
    prompt,
    isEssay,
    numBodyParagraphs,
    defaultChunksPerBp,
    chunkRatioRaw,
    hasCounterargument,
    dueAt,
    classPeriodId,
    sourceText,
    sourceTextRaw,
    sourceTitle,
    sourceAuthor,
    sourceCitation,
    sourceUrl,
    sourceHtml,
    sourceRenderModeRaw,
    sourceFilePath,
    sourceFileName,
    sourceFileMime,
  };
}

const VALID_RENDER_MODES = new Set(["pdf", "rich", "plain"]);

/**
 * Resolve the full set of source_* columns for an insert/update.
 *
 * Narrative mode has no source → everything null. Otherwise:
 *   - rich:  sanitize the posted HTML, then DERIVE source_text from it (the
 *            canonical annotation substrate — see lib/source-content.ts). The
 *            client's plain source_text is ignored for rich content.
 *   - pdf/plain: source_text is the extracted/typed text; no source_html.
 */
function buildSourceColumns(
  f: ReturnType<typeof parseCommonFields>,
  isNarrative: boolean
) {
  if (isNarrative) {
    return {
      source_text: null,
      source_title: null,
      source_author: null,
      source_citation: null,
      source_url: null,
      source_html: null,
      source_render_mode: null,
      source_file_path: null,
      source_file_name: null,
      source_file_mime: null,
    };
  }

  const mode = VALID_RENDER_MODES.has(f.sourceRenderModeRaw)
    ? (f.sourceRenderModeRaw as "pdf" | "rich" | "plain")
    : null;

  const shared = {
    source_title: f.sourceTitle,
    source_author: f.sourceAuthor,
    source_citation: f.sourceCitation,
    source_url: f.sourceUrl,
    source_file_path: f.sourceFilePath,
    source_file_name: f.sourceFileName,
    source_file_mime: f.sourceFileMime,
  };

  if (mode === "rich" && f.sourceHtml) {
    const sanitized = sanitizeSourceHtml(f.sourceHtml);
    const substrate = sourceHtmlToSubstrate(sanitized);
    return {
      ...shared,
      source_html: emptyToNull(sanitized),
      // Stored untrimmed so it matches the rendered DOM textContent exactly
      // (annotation offsets index into this string).
      source_text: substrate.trim() === "" ? null : substrate,
      source_render_mode: "rich" as const,
    };
  }

  if (mode === "pdf") {
    return {
      ...shared,
      source_html: null,
      // Verbatim pdf.js substrate (untrimmed) — equal byte-for-byte to the
      // buildPdfText() output the annotate text layer reproduces at render, so
      // offsets never drift. See the sourceTextRaw note in parseCommonFields.
      source_text: f.sourceTextRaw,
      source_render_mode: "pdf" as const,
    };
  }

  return {
    ...shared,
    source_html: null,
    source_text: f.sourceText,
    source_render_mode: mode ?? (f.sourceText ? "plain" : null),
  };
}

/**
 * Parse the rubric hidden input. Always returns a Rubric — never null —
 * matching the "treat null and { criteria: [] } identically" rule. On
 * shape failure returns a validation error in form-state shape.
 */
function parseAndValidateRubric(formData: FormData): {
  ok: true;
  rubric: ReturnType<typeof emptyRubric>;
} | {
  ok: false;
  state: AssignmentFormState;
} {
  const raw = formData.get("rubric");
  if (raw == null || raw === "") {
    return { ok: true, rubric: emptyRubric() };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    return { ok: false, state: { fieldErrors: { rubric: "Rubric is malformed JSON." } } };
  }
  const result = validateRubric(parsed);
  if (!result.ok) {
    return { ok: false, state: { fieldErrors: { rubric: result.error } } };
  }
  return { ok: true, rubric: result.value };
}

function validateCommon(
  f: ReturnType<typeof parseCommonFields>,
  mode: Mode
):
  | { ok: true; chunkRatio: ChunkRatio; hasCounterargument: boolean }
  | { ok: false; state: AssignmentFormState } {
  if (!f.title) {
    return { ok: false, state: { fieldErrors: { title: "Title is required." } } };
  }
  if (f.title.length > 255) {
    return {
      ok: false,
      state: { fieldErrors: { title: "Title must be 255 characters or fewer." } },
    };
  }
  if (!f.prompt) {
    return {
      ok: false,
      state: { fieldErrors: { prompt: "Prompt is required." } },
    };
  }
  if (f.prompt.length > 5000) {
    return {
      ok: false,
      state: {
        fieldErrors: { prompt: "Prompt must be 5000 characters or fewer." },
      },
    };
  }

  // Mode-specific chunk ratio enforcement. Literary assignments lock to the
  // 1:2+ literary ratio; the CHECK constraint (migration 0038) rejects a
  // literary assignment carrying a non-literary ratio.
  let chunkRatio: ChunkRatio;
  if (mode === "literary") {
    chunkRatio = "lit_one_to_two_plus";
  } else {
    if (!VALID_RATIOS.has(f.chunkRatioRaw as ChunkRatio)) {
      return { ok: false, state: { error: "Invalid chunk ratio." } };
    }
    chunkRatio = f.chunkRatioRaw as ChunkRatio;
  }

  // Argumentation-only flag — silently coerce to false for other modes.
  const hasCounterargument =
    mode === "argumentation" ? f.hasCounterargument : false;

  // is_essay implies multi-body-paragraph; schema CHECK is 1-10.
  if (f.isEssay && f.numBodyParagraphs < 2) {
    return {
      ok: false,
      state: {
        fieldErrors: {
          num_body_paragraphs:
            "Essays need at least 2 body paragraphs.",
        },
      },
    };
  }
  if (f.numBodyParagraphs < 1 || f.numBodyParagraphs > 10) {
    return {
      ok: false,
      state: {
        fieldErrors: {
          num_body_paragraphs:
            "Body paragraphs must be between 1 and 10.",
        },
      },
    };
  }
  if (f.defaultChunksPerBp < 1 || f.defaultChunksPerBp > 5) {
    return {
      ok: false,
      state: {
        fieldErrors: {
          default_chunks_per_bp: "Chunks per body paragraph must be 1-5.",
        },
      },
    };
  }

  return { ok: true, chunkRatio, hasCounterargument };
}

/* ─── Create draft ───────────────────────────────────────────────────── */

export async function createDraftAssignment(
  _prev: AssignmentFormState,
  formData: FormData
): Promise<AssignmentFormState> {
  const profile = await requireRole(["teacher"]);

  const modeRaw = String(formData.get("mode") ?? "");
  if (!VALID_MODES.has(modeRaw as Mode)) {
    return { error: "Invalid mode." };
  }
  const mode = modeRaw as Mode;

  const f = parseCommonFields(formData);
  const v = validateCommon(f, mode);
  if (!v.ok) return v.state;

  const r = parseAndValidateRubric(formData);
  if (!r.ok) return r.state;

  // Narrative mode has no source text — coerce all source_* to null
  // even if the form somehow sent values (defense in depth).
  const isNarrative = mode === "narrative";

  // Teachers always have a district (enforced by a DB CHECK on user_profiles);
  // this narrows the now-nullable type and guards the impossible case.
  if (!profile.district_id) {
    return { error: "Your profile isn't attached to a district." };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      teacher_id: profile.id,
      district_id: profile.district_id,
      school_id: profile.school_id!,
      title: f.title,
      prompt: f.prompt,
      mode,
      is_essay: f.isEssay,
      num_body_paragraphs: f.isEssay ? f.numBodyParagraphs : 1,
      default_chunk_ratio: v.chunkRatio,
      default_chunks_per_bp: f.isEssay ? f.defaultChunksPerBp : 1,
      has_counterargument: v.hasCounterargument,
      ...buildSourceColumns(f, isNarrative),
      rubric: r.rubric as unknown as Json,
      due_at: f.dueAt,
      class_period_id: f.classPeriodId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to create assignment." };
  }

  redirect(`/dashboard/assignments/${data.id}`);
}

/* ─── Update (draft or published) ────────────────────────────────────── */

export async function updateDraftAssignment(
  _prev: AssignmentFormState,
  formData: FormData
): Promise<AssignmentFormState> {
  const profile = await requireRole(["teacher"]);

  const assignmentId = String(formData.get("assignment_id") ?? "");
  if (!assignmentId) return { error: "Missing assignment id." };

  const supabase = await createServerClient();
  const { data: existing } = await supabase
    .from("assignments")
    .select("released_at, mode")
    .eq("id", assignmentId)
    .eq("teacher_id", profile.id)
    .maybeSingle();

  if (!existing) return { error: "Assignment not found." };

  const f = parseCommonFields(formData);
  const isPublished = existing.released_at !== null;

  if (!f.title) {
    return { fieldErrors: { title: "Title is required." } };
  }
  if (!f.prompt) {
    return { fieldErrors: { prompt: "Prompt is required." } };
  }

  let update: Record<string, unknown>;
  if (isPublished) {
    // Locked after publish: mode, is_essay, num_body_paragraphs,
    // default_chunks_per_bp, default_chunk_ratio, has_counterargument,
    // source_text, source_title, source_author, source_citation,
    // source_url, source_html, source_render_mode, source_file_*, rubric.
    // Only title/prompt/due_at/class_period_id stay editable. Freezing the
    // source after publish also guarantees annotation offsets never drift.
    update = {
      title: f.title,
      prompt: f.prompt,
      due_at: f.dueAt,
      class_period_id: f.classPeriodId,
    };
  } else {
    const v = validateCommon(f, existing.mode);
    if (!v.ok) return v.state;

    const r = parseAndValidateRubric(formData);
    if (!r.ok) return r.state;

    const isNarrative = existing.mode === "narrative";

    update = {
      title: f.title,
      prompt: f.prompt,
      is_essay: f.isEssay,
      num_body_paragraphs: f.isEssay ? f.numBodyParagraphs : 1,
      default_chunk_ratio: v.chunkRatio,
      default_chunks_per_bp: f.isEssay ? f.defaultChunksPerBp : 1,
      has_counterargument: v.hasCounterargument,
      ...buildSourceColumns(f, isNarrative),
      rubric: r.rubric as unknown as Json,
      due_at: f.dueAt,
      class_period_id: f.classPeriodId,
    };
  }

  const { error } = await supabase
    .from("assignments")
    .update(update)
    .eq("id", assignmentId)
    .eq("teacher_id", profile.id);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/assignments/${assignmentId}`);
  return { success: "Saved." };
}

/* ─── Delete + unpublish ─────────────────────────────────────────────── */

/**
 * Mutation safety model — both DB-level and app-level guards in play:
 *
 *   1. DB constraint (migration 0007_assignment_cascade_safety.sql):
 *      student_writings.assignment_id is ON DELETE RESTRICT, so any
 *      attempt to drop an assignment with attached writings raises a
 *      foreign-key violation at the Postgres layer. This is the real
 *      safety net — it protects against raw SQL, third-party admin
 *      tools, or any code path that bypasses these actions.
 *
 *   2. Application count check (the `count` query below):
 *      We count student_writings before issuing the DELETE/UPDATE so
 *      we can surface a friendly error message instead of a raw FK
 *      violation. Same logic for unpublish — we don't want students
 *      to lose access mid-writing.
 *
 * Future-Claude / future-Raymond at 3am: if you're tempted to remove
 * the count query because "RESTRICT will catch it anyway" — DON'T.
 * The check is for UX, not security. The migration is the security.
 */

async function countStudentWritings(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  assignmentId: string
): Promise<number> {
  const { count } = await supabase
    .from("student_writings")
    .select("*", { count: "exact", head: true })
    .eq("assignment_id", assignmentId);
  return count ?? 0;
}

export async function deleteAssignment(
  _prev: AssignmentFormState,
  formData: FormData
): Promise<AssignmentFormState> {
  const profile = await requireRole(["teacher"]);

  const assignmentId = String(formData.get("assignment_id") ?? "");
  if (!assignmentId) return { error: "Missing assignment id." };

  const supabase = await createServerClient();
  const { data: existing } = await supabase
    .from("assignments")
    .select("released_at")
    .eq("id", assignmentId)
    .eq("teacher_id", profile.id)
    .maybeSingle();

  if (!existing) return { error: "Assignment not found." };
  if (existing.released_at !== null) {
    return {
      error: "Cannot delete a published assignment. Unpublish it first.",
    };
  }

  const writingCount = await countStudentWritings(supabase, assignmentId);
  if (writingCount > 0) {
    return {
      error:
        "Cannot delete this assignment — students have already started writing. Unpublish it instead to prevent further work, or contact your admin to remove this assignment along with the existing student writings.",
    };
  }

  const { error } = await supabase
    .from("assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("teacher_id", profile.id);

  if (error) return { error: error.message };

  redirect("/dashboard/assignments");
}

/**
 * Cancel + hard-delete an assignment, INCLUDING all student work.
 *
 * This is the destructive escape hatch for the case deleteAssignment refuses:
 * students have already started writing. It deletes every student_writings row
 * for the assignment (which cascades to all per-writing artifacts — chunks,
 * CDs, CMs, t-charts, shaping sheets, etc. — via ON DELETE CASCADE), then
 * deletes the assignment itself. Order matters: migration 0007 set the
 * student_writings → assignments FK to ON DELETE RESTRICT, so the assignment
 * cannot be removed until its writings are gone.
 *
 * Authorization: the owning teacher OR a school/district/super admin in scope
 * (auth_user_is_admin_for_school). student_writings has no DELETE RLS policy,
 * so the actual deletes run through the service-role admin client. The action
 * authorizes via the RLS-scoped client first, then writes an audit_log row.
 *
 * IRREVERSIBLE. The UI guards with an explicit confirmation naming the count.
 */
export async function cancelAssignment(
  _prev: AssignmentFormState,
  formData: FormData
): Promise<AssignmentFormState> {
  const profile = await requireUser();

  const assignmentId = String(formData.get("assignment_id") ?? "");
  if (!assignmentId) return { error: "Missing assignment id." };

  // Read via the RLS-scoped client. Returning a row means the caller is the
  // owner, a co-teacher, or an admin in scope — we narrow further below.
  const supabase = await createServerClient();
  const { data: assignment, error: readErr } = await supabase
    .from("assignments")
    .select("id, title, teacher_id, district_id, school_id")
    .eq("id", assignmentId)
    .maybeSingle();

  if (readErr) return { error: readErr.message };
  if (!assignment) return { error: "Assignment not found." };

  // Authorize: owning teacher OR school/district/super admin in scope.
  let authorized = assignment.teacher_id === profile.id;
  if (!authorized) {
    const { data: isAdmin } = await supabase.rpc(
      "auth_user_is_admin_for_school",
      { s_id: assignment.school_id }
    );
    authorized = isAdmin === true;
  }
  if (!authorized) {
    return {
      error: "You don't have permission to cancel this assignment.",
    };
  }

  // student_writings has no DELETE policy for end users — use the service role.
  const admin = createAdminClient();

  const { count: writingCount } = await admin
    .from("student_writings")
    .select("*", { count: "exact", head: true })
    .eq("assignment_id", assignmentId);

  // Delete writings first (cascades to all artifacts), then the assignment.
  const { error: writingsErr } = await admin
    .from("student_writings")
    .delete()
    .eq("assignment_id", assignmentId);
  if (writingsErr) {
    return { error: `Failed to remove student work: ${writingsErr.message}` };
  }

  const { error: assignmentErr } = await admin
    .from("assignments")
    .delete()
    .eq("id", assignmentId);
  if (assignmentErr) {
    return { error: `Failed to delete assignment: ${assignmentErr.message}` };
  }

  // Append-only audit trail of this privileged, destructive action.
  await admin.from("audit_log").insert({
    actor_id: profile.id,
    action: "assignment.cancel_delete",
    target_scope: { assignment_id: assignmentId },
    metadata: {
      title: assignment.title,
      student_writings_deleted: writingCount ?? 0,
      acted_as: assignment.teacher_id === profile.id ? "owner" : "admin",
    },
    district_id: assignment.district_id,
    school_id: assignment.school_id,
  });

  revalidatePath("/dashboard/assignments");
  redirect("/dashboard/assignments");
}

export async function unpublishAssignment(
  _prev: AssignmentFormState,
  formData: FormData
): Promise<AssignmentFormState> {
  const profile = await requireRole(["teacher"]);

  const assignmentId = String(formData.get("assignment_id") ?? "");
  if (!assignmentId) return { error: "Missing assignment id." };

  const supabase = await createServerClient();
  const { data: existing } = await supabase
    .from("assignments")
    .select("released_at")
    .eq("id", assignmentId)
    .eq("teacher_id", profile.id)
    .maybeSingle();

  if (!existing) return { error: "Assignment not found." };
  if (existing.released_at === null) {
    return { error: "This assignment is already a draft." };
  }

  // Unpublishing is always permitted, even when students have started
  // writing: setting released_at = null hides the assignment via RLS but
  // preserves every student_writing row. Re-publishing restores access.
  // The UI warns the teacher about temporary loss of access.
  const { error } = await supabase
    .from("assignments")
    .update({ released_at: null })
    .eq("id", assignmentId)
    .eq("teacher_id", profile.id);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/assignments/${assignmentId}`);
  revalidatePath("/dashboard/assignments");
  return { success: "Unpublished. You can edit and re-publish." };
}

/* ─── Publish ────────────────────────────────────────────────────────── */

export async function publishAssignment(
  _prev: AssignmentFormState,
  formData: FormData
): Promise<AssignmentFormState> {
  const profile = await requireRole(["teacher"]);

  const assignmentId = String(formData.get("assignment_id") ?? "");
  if (!assignmentId) return { error: "Missing assignment id." };

  const supabase = await createServerClient();
  const { data: existing } = await supabase
    .from("assignments")
    .select("released_at, title, prompt, class_period_id")
    .eq("id", assignmentId)
    .eq("teacher_id", profile.id)
    .maybeSingle();

  if (!existing) return { error: "Assignment not found." };
  if (existing.released_at) return { error: "Already published." };
  if (!existing.title.trim() || !existing.prompt.trim()) {
    return { error: "Save a title and prompt before publishing." };
  }
  if (!existing.class_period_id) {
    return { error: "Pick a class period before publishing." };
  }

  const { error } = await supabase
    .from("assignments")
    .update({ released_at: new Date().toISOString() })
    .eq("id", assignmentId)
    .eq("teacher_id", profile.id);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/assignments/${assignmentId}`);
  revalidatePath("/dashboard/assignments");
  return { success: "Published." };
}
