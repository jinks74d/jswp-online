/**
 * Assignment form parsing and validation.
 *
 * Extracted verbatim from lib/actions/assignments.ts. That module is
 * "use server", where every export must be an async function — so none of
 * this could be exported, and therefore none of it could be reached by a
 * test. Pure functions live here; the action module keeps only the parts
 * that touch Supabase, storage, or Next.js request context.
 *
 * Nothing here performs authorization. Proving the caller actually teaches
 * the periods they posted is `assertTeachesPeriods` in the action module,
 * which needs a database round-trip.
 */

import type { Database } from "@/lib/database.types";
import type { AssignmentFormState } from "./form-state";

export type Mode = Database["public"]["Enums"]["jswp_mode"];
export type ChunkRatio = Database["public"]["Enums"]["jswp_chunk_ratio"];

export const VALID_MODES = new Set<Mode>([
  "expository",
  "argumentation",
  "literary",
  "narrative",
]);

export const VALID_RATIOS = new Set<ChunkRatio>([
  "lit_one_to_two_plus",
  "lit_three_plus_to_zero",
  "nar_two_plus_to_one",
  "nonlit_summary_three_plus_to_zero",
  "nonlit_expository_two_plus_to_one",
  "nonlit_argumentation_two_plus_to_one",
  "nonlit_expository_one_to_one",
]);

export function parseTimestamp(raw: string): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function emptyToNull(s: string): string | null {
  const v = s.trim();
  return v === "" ? null : v;
}

export type AssignmentPeriodInput = {
  class_period_id: string;
  due_at: string | null;
};

/**
 * Parse the `class_periods` hidden input — a JSON array of
 * `{ class_period_id, due_at }`, one per period the teacher selected.
 *
 * `due_at` is that period's override; null/absent inherits the assignment
 * default (see lib/assignment-due-dates.ts). Duplicates are collapsed rather
 * than rejected: the junction's primary key would reject them anyway, and a
 * repeated period is a UI glitch, not something to fail a teacher's save over.
 * The caller still has to prove the teacher is on each period — see
 * `assertTeachesPeriods`.
 */
export function parseClassPeriods(formData: FormData): AssignmentPeriodInput[] {
  const raw = formData.get("class_periods");
  if (raw == null || raw === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: AssignmentPeriodInput[] = [];
  const seen = new Set<string>();
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const o = entry as Record<string, unknown>;
    const id =
      typeof o.class_period_id === "string" ? o.class_period_id.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      class_period_id: id,
      due_at:
        typeof o.due_at === "string" ? parseTimestamp(o.due_at) : null,
    });
  }
  return out;
}

export function parseCommonFields(formData: FormData) {
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
  const periods = parseClassPeriods(formData);
  // The legacy single column (migration 0050 keeps it until every reader is
  // cut over). First selected period wins so existing readers see something
  // sensible; `assignment_class_periods` is the real answer.
  const classPeriodId = periods[0]?.class_period_id ?? null;

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
    periods,
  };
}

export function validateCommon(
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

  if (!f.dueAt) {
    return {
      ok: false,
      state: { fieldErrors: { due_at: "Due date is required." } },
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
