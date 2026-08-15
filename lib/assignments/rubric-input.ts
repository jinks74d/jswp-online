/**
 * Rubric input parsing for the assignment form — both the inline rubric JSON
 * and the attached rubric document.
 *
 * Extracted verbatim from lib/actions/assignments.ts — see parse-form.ts for
 * why. `sweepReplacedRubricFile` stays in the action module: it deletes from
 * storage and must run after a successful write.
 *
 * Named rubric-input.ts rather than rubric.ts so it does not read as a second
 * lib/rubric.ts. That module owns the rubric SHAPE and its validator; this one
 * owns pulling a rubric out of a FormData and checking the file path is the
 * caller's to reference.
 */

import { validateRubric, emptyRubric } from "@/lib/rubric";
import {
  isRubricFilePathForTeacher,
  parseRubricFileInput,
  type RubricFile,
} from "@/lib/rubric-file";
import type { AssignmentFormState } from "./form-state";

/**
 * Parse the `rubric` hidden input. Absent/blank yields an empty rubric,
 * matching the "treat null and { criteria: [] } identically" rule. On
 * shape failure returns a validation error in form-state shape.
 */
export function parseAndValidateRubric(formData: FormData): {
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

/**
 * Resolve the attached rubric document from the `rubric_file` hidden input.
 *
 * The client uploads the file itself and posts the resulting storage key back,
 * so the key is UNTRUSTED input that the server then both persists and — on a
 * later save — deletes. Requiring it to sit under the caller's own upload
 * folder is what stops this two-save sequence:
 *
 *   Save 1 — a teacher forges `path` to a colleague's rubric object.
 *   Save 2 — the row now "used to" point there, so the replace-sweep below
 *            deletes a file that is still referenced by the other row.
 *
 * A school-wide check would let that through, since both teachers share a
 * school. See isRubricFilePathForTeacher.
 *
 * A missing/blank/malformed field means "no rubric document", which is also
 * how a removal arrives.
 */
export function resolveRubricFile(
  formData: FormData,
  schoolId: string,
  teacherId: string
):
  | { ok: true; file: RubricFile | null }
  | { ok: false; state: AssignmentFormState } {
  const file = parseRubricFileInput(formData.get("rubric_file"));
  if (file && !isRubricFilePathForTeacher(file.path, schoolId, teacherId)) {
    return {
      ok: false,
      state: {
        fieldErrors: {
          rubric_file:
            "That rubric file wasn't uploaded from this form. Re-select it and save again.",
        },
      },
    };
  }
  return { ok: true, file };
}

/** The three DB columns for an attached rubric document (or its absence). */
export function rubricFileColumns(file: RubricFile | null) {
  return {
    rubric_file_path: file?.path ?? null,
    rubric_file_name: file?.name ?? null,
    rubric_file_mime: file?.mime || null,
  };
}
