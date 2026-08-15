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
import { writeAuditLog } from "@/lib/audit-log";
import { isRubricFilePathForTeacher } from "@/lib/rubric-file";
import { removeRubricFile } from "@/lib/storage/assignment-rubrics";
import type { Json } from "@/lib/database.types";
import {
  VALID_MODES,
  parseCommonFields,
  validateCommon,
  type Mode,
  type AssignmentPeriodInput,
} from "@/lib/assignments/parse-form";
import {
  parseSources,
  resolveSourceColumns,
  isEmptySource,
  type SourceInput,
} from "@/lib/assignments/sources";
import {
  parseAndValidateRubric,
  resolveRubricFile,
  rubricFileColumns,
} from "@/lib/assignments/rubric-input";
import type { AssignmentFormState } from "@/lib/assignments/form-state";

// Re-exported so the three form components keep importing it from here.
export type { AssignmentFormState };

/* ─── Helpers ────────────────────────────────────────────────────────── */

/**
 * Refuse period ids the caller does not actually teach.
 *
 * The select is populated from the teacher's own periods, so a bad id here is
 * a forged post, not a mistake. Without this a teacher could assign work into
 * a colleague's class: `assignments_teacher_own` lets them write any row where
 * `teacher_id = auth.uid()`, and the junction's write policy defers to
 * `auth_user_can_write_assignment`, which is satisfied by owning the
 * assignment — neither one looks at whether the PERIOD is theirs.
 */
async function assertTeachesPeriods(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  teacherId: string,
  periods: readonly AssignmentPeriodInput[],
  schoolId: string
): Promise<string | null> {
  if (periods.length === 0) return null;

  const ids = periods.map((p) => p.class_period_id);
  const { data, error } = await supabase
    .from("class_teacher_assignments")
    .select("class_period_id, class_period:class_period_id ( school_id )")
    .eq("teacher_id", teacherId)
    .in("class_period_id", ids);

  if (error) return `Could not verify your class periods: ${error.message}`;

  const rows = (data ?? []) as unknown as {
    class_period_id: string;
    class_period: { school_id: string } | { school_id: string }[] | null;
  }[];

  const taught = new Set(rows.map((r) => r.class_period_id));
  const rejected = ids.filter((id) => !taught.has(id));
  if (rejected.length > 0) {
    return "One of the selected class periods isn't yours to assign to.";
  }

  // Schools are independent: a period may only be assigned within the school
  // that owns the assignment. The 0051 policy enforces this too, but it does
  // so mid-write with a raw "violates row-level security policy" — checking
  // here turns that into a readable validation error BEFORE anything is
  // written. A teacher who genuinely teaches at two schools can still hold
  // periods at both; only mixing them into one assignment is refused.
  const offSchool = rows.filter((r) => {
    const cp = Array.isArray(r.class_period) ? r.class_period[0] : r.class_period;
    return cp != null && cp.school_id !== schoolId;
  });
  if (offSchool.length > 0) {
    return "Those classes are at a different school. An assignment can only go to classes at its own school.";
  }
  return null;
}

/**
 * Replace an assignment's periods with exactly `periods`.
 *
 * Delete-then-insert is safe here in a way it is NOT for sources: a junction
 * row carries only a due date, and nothing references it (student_writings
 * hang off the assignment, not the pairing), so removing and re-adding a
 * period loses no student work. Removing a period a student already started
 * in is still meaningful — it revokes their access — which is why the
 * published path below only ever ADDS.
 *
 * The delete and the insert go through the 0052 RPC rather than two PostgREST
 * calls, because two calls are not atomic: a committed DELETE followed by a
 * failing INSERT left the assignment with ZERO periods while returning an
 * error the teacher reads as "nothing was saved". That is reachable with
 * student work in flight — unpublishing is permitted mid-writing, which
 * returns the assignment to this replace path. The RPC body is one
 * transaction, so a failing insert rolls the delete back with it. It is
 * SECURITY INVOKER, so the 0051 write policy still authorizes every row.
 */
async function writeAssignmentPeriods(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  assignmentId: string,
  periods: readonly AssignmentPeriodInput[]
): Promise<string | null> {
  const { error } = await supabase.rpc("replace_assignment_class_periods", {
    p_assignment_id: assignmentId,
    p_periods: periods.map((p) => ({
      class_period_id: p.class_period_id,
      due_at: p.due_at,
    })),
  });
  if (error) return `Failed to update class periods: ${error.message}`;
  return null;
}

/**
 * The published path's additive-only period write now lives in the 0053 RPC,
 * called with p_replace = false: it merges p_periods in and never deletes.
 *
 * That rule is unchanged and still load-bearing. A teacher can hand the same
 * assignment to another class mid-unit, and can still adjust the due date of a
 * class already on it (a deadline extension is the single most common
 * post-publish edit and withholding it helps nobody). What they cannot do is
 * REMOVE a period — that would silently revoke access for students who may
 * already have work in progress.
 */

const SOURCE_BUCKET = "assignment-sources";

/**
 * Replace an unpublished assignment's sources with the posted set. Any
 * uploaded files that are no longer referenced are removed from the
 * assignment-sources bucket (best-effort) so they don't orphan.
 *
 * Delete-and-reinsert is safe here because this only runs on UNPUBLISHED
 * assignments (the published path freezes sources), which have no student
 * writings and therefore no annotations pointing at these source rows.
 */
async function writeAssignmentSources(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  assignmentId: string,
  sources: SourceInput[],
  isNarrative: boolean
): Promise<{ error: string | null }> {
  const { data: existing } = await supabase
    .from("assignment_sources")
    .select("source_file_path")
    .eq("assignment_id", assignmentId);
  const oldPaths = new Set(
    (existing ?? [])
      .map((r) => r.source_file_path)
      .filter((p): p is string => !!p)
  );

  const { error: delErr } = await supabase
    .from("assignment_sources")
    .delete()
    .eq("assignment_id", assignmentId);
  if (delErr) return { error: delErr.message };

  const resolved = isNarrative
    ? []
    : sources
        .map((s) => ({ kind: s.kind, cols: resolveSourceColumns(s) }))
        .filter((r) => !isEmptySource(r.cols));

  if (resolved.length > 0) {
    const rows = resolved.map((r, i) => ({
      assignment_id: assignmentId,
      position: i + 1,
      kind: r.kind,
      ...r.cols,
    }));
    const { error: insErr } = await supabase
      .from("assignment_sources")
      .insert(rows);
    if (insErr) return { error: insErr.message };
  }

  // Remove files no longer referenced by any source (best-effort).
  const newPaths = new Set(
    resolved
      .map((r) => r.cols.source_file_path)
      .filter((p): p is string => !!p)
  );
  const orphaned = [...oldPaths].filter((p) => !newPaths.has(p));
  if (orphaned.length > 0) {
    await supabase.storage.from(SOURCE_BUCKET).remove(orphaned);
  }

  return { error: null };
}

/**
 * Append newly-added sources to a PUBLISHED assignment.
 *
 * Strictly additive: rows that already exist (posted with a source_id) are
 * never updated, re-keyed, or deleted, because text_annotations.source_id
 * points at them and their character offsets index the stored substrate. A
 * delete-and-reinsert here would cascade every student's annotations away.
 *
 * Only rows the teacher added in this session (source_id === "") are inserted,
 * after the highest existing position. Files are never removed either: an
 * orphan check would have to reason about rows we deliberately did not read.
 */
async function appendAssignmentSources(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  assignmentId: string,
  sources: SourceInput[],
  isNarrative: boolean
): Promise<{ error: string | null }> {
  if (isNarrative) return { error: null };

  const added = sources.filter((s) => s.source_id.trim() === "");
  if (added.length === 0) return { error: null };

  const resolved = added
    .map((s) => ({ kind: s.kind, cols: resolveSourceColumns(s) }))
    .filter((r) => !isEmptySource(r.cols));
  if (resolved.length === 0) return { error: null };

  const { data: existing, error: posErr } = await supabase
    .from("assignment_sources")
    .select("position")
    .eq("assignment_id", assignmentId)
    .order("position", { ascending: false })
    .limit(1);
  if (posErr) return { error: posErr.message };

  const nextPosition = (existing?.[0]?.position ?? 0) + 1;
  const rows = resolved.map((r, i) => ({
    assignment_id: assignmentId,
    position: nextPosition + i,
    kind: r.kind,
    ...r.cols,
  }));

  const { error: insErr } = await supabase
    .from("assignment_sources")
    .insert(rows);
  if (insErr) return { error: insErr.message };

  return { error: null };
}

/**
 * Sweep a storage object the just-saved row no longer points at. Best-effort
 * and deliberately AFTER the successful write: deleting first would destroy
 * the teacher's file if the update then failed.
 *
 * Re-checks ownership of the OUTGOING path even though resolveRubricFile
 * already gates the incoming one. Belt and braces on the destructive step: a
 * row could carry a path written before this rule existed, or by some future
 * code path, and "delete whatever the column says" is exactly the primitive
 * that turns a bad column value into someone else's lost file.
 */
async function sweepReplacedRubricFile(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  previousPath: string | null,
  nextPath: string | null,
  schoolId: string,
  teacherId: string
): Promise<void> {
  if (!previousPath || previousPath === nextPath) return;
  if (!isRubricFilePathForTeacher(previousPath, schoolId, teacherId)) {
    // Not ours to delete — drop the reference, leave the object alone.
    return;
  }
  await removeRubricFile(supabase, previousPath);
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

  const rf = resolveRubricFile(formData, profile.school_id!, profile.id);
  if (!rf.ok) return rf.state;

  const supabase = await createServerClient();

  // The new row is stamped with profile.school_id, so that is the school the
  // chosen periods must belong to.
  const periodAuthErr = await assertTeachesPeriods(
    supabase,
    profile.id,
    f.periods,
    profile.school_id!
  );
  if (periodAuthErr) {
    return { fieldErrors: { class_periods: periodAuthErr } };
  }

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
      rubric: r.rubric as unknown as Json,
      ...rubricFileColumns(rf.file),
      due_at: f.dueAt,
      class_period_id: f.classPeriodId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to create assignment." };
  }

  const { error: srcErr } = await writeAssignmentSources(
    supabase,
    data.id,
    parseSources(formData),
    isNarrative
  );
  if (srcErr) return { error: srcErr };

  const periodErr = await writeAssignmentPeriods(supabase, data.id, f.periods);
  if (periodErr) return { error: periodErr };

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
    .select("released_at, mode, school_id, rubric_file_path")
    .eq("id", assignmentId)
    .eq("teacher_id", profile.id)
    .maybeSingle();

  if (!existing) return { error: "Assignment not found." };

  const f = parseCommonFields(formData);
  const isPublished = existing.released_at !== null;

  // profile.id is the row's teacher_id — the select above filters on it.
  const rf = resolveRubricFile(formData, existing.school_id, profile.id);
  if (!rf.ok) return rf.state;

  // Match against the ASSIGNMENT's school, not the teacher's current one — a
  // teacher who has since transferred is still editing a row that belongs to
  // the old school, and 0051 compares the period to that row.
  const periodAuthErr = await assertTeachesPeriods(
    supabase,
    profile.id,
    f.periods,
    existing.school_id
  );
  if (periodAuthErr) {
    return { fieldErrors: { class_periods: periodAuthErr } };
  }

  if (!f.title) {
    return { fieldErrors: { title: "Title is required." } };
  }
  if (!f.prompt) {
    return { fieldErrors: { prompt: "Prompt is required." } };
  }
  if (!f.dueAt) {
    return { fieldErrors: { due_at: "Due date is required." } };
  }

  let update: Record<string, unknown>;
  if (isPublished) {
    // Locked after publish: mode, is_essay, num_body_paragraphs,
    // default_chunks_per_bp, default_chunk_ratio, has_counterargument,
    // rubric, and every column of an EXISTING source. Only
    // title/prompt/due_at/class_period_id stay editable. Freezing saved
    // sources is what guarantees annotation offsets never drift.
    //
    // Adding a source is the exception: it is purely additive, touches no
    // existing row, and lets a teacher hand out a second reading mid-unit.
    const { error: srcErr } = await appendAssignmentSources(
      supabase,
      assignmentId,
      parseSources(formData),
      existing.mode === "narrative"
    );
    if (srcErr) return { error: srcErr };

    // Class periods follow the same additive rule — hand the assignment to
    // another class mid-unit, adjust the deadline of a class already on it,
    // but never drop a period, since students there may have work in
    // progress. The write itself happens below, together with the row.
    update = {
      title: f.title,
      prompt: f.prompt,
      due_at: f.dueAt,
    };

    // The rubric document follows the same additive rule as sources: a
    // teacher who published without one can still attach it, but a document
    // students may already have been graded against is not swapped or
    // removed underneath them. Unpublish to do that.
    if (!existing.rubric_file_path && rf.file) {
      Object.assign(update, rubricFileColumns(rf.file));
    }
  } else {
    const v = validateCommon(f, existing.mode);
    if (!v.ok) return v.state;

    const r = parseAndValidateRubric(formData);
    if (!r.ok) return r.state;

    const isNarrative = existing.mode === "narrative";

    // Replace the child-table sources. Safe pre-publish (no writings/
    // annotations reference them; the published path freezes sources).
    const { error: srcErr } = await writeAssignmentSources(
      supabase,
      assignmentId,
      parseSources(formData),
      isNarrative
    );
    if (srcErr) return { error: srcErr };

    // The periods are REPLACED outright rather than merged. Safe pre-publish
    // for the same reason as sources: no student can have started work on an
    // unreleased assignment. The write happens below, together with the row.
    update = {
      title: f.title,
      prompt: f.prompt,
      is_essay: f.isEssay,
      num_body_paragraphs: f.isEssay ? f.numBodyParagraphs : 1,
      default_chunk_ratio: v.chunkRatio,
      default_chunks_per_bp: f.isEssay ? f.defaultChunksPerBp : 1,
      has_counterargument: v.hasCounterargument,
      rubric: r.rubric as unknown as Json,
      ...rubricFileColumns(rf.file),
      due_at: f.dueAt,
      class_period_id: f.classPeriodId,
    };
  }

  // Row and periods in ONE transaction (0053). Done as two calls, a failing
  // row update would leave the periods already rewritten against a row that
  // never changed — the teacher is told the save failed while half of it
  // landed. p_replace distinguishes the two paths: drafts replace the period
  // set outright, published assignments only ever merge into it.
  const { error } = await supabase.rpc("save_assignment_with_periods", {
    p_assignment_id: assignmentId,
    p_teacher_id: profile.id,
    p_periods: f.periods.map((p) => ({
      class_period_id: p.class_period_id,
      due_at: p.due_at,
    })),
    p_replace: !isPublished,
    p_update: update as Json,
  });

  if (error) return { error: error.message };

  // Only now that the row is committed: drop the object the row used to point
  // at. `update` carries rubric_file_path only when this save was allowed to
  // change it, so a published assignment never sweeps its locked document.
  if ("rubric_file_path" in update) {
    await sweepReplacedRubricFile(
      supabase,
      existing.rubric_file_path,
      (update.rubric_file_path as string | null) ?? null,
      existing.school_id,
      profile.id
    );
  }

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
    .select("released_at, school_id, rubric_file_path")
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

  // Remove uploaded source files before the row cascade (best-effort).
  const { data: srcFiles } = await supabase
    .from("assignment_sources")
    .select("source_file_path")
    .eq("assignment_id", assignmentId);
  const filePaths = (srcFiles ?? [])
    .map((r) => r.source_file_path)
    .filter((p): p is string => !!p);
  // The attached rubric document lives in the same bucket — sweep it too, but
  // only when the stored path is one this teacher uploaded. A column value
  // that fails that test is a reference to someone else's object, and
  // deleting the row is not a licence to delete their file.
  if (
    existing.rubric_file_path &&
    isRubricFilePathForTeacher(
      existing.rubric_file_path,
      existing.school_id,
      profile.id
    )
  ) {
    filePaths.push(existing.rubric_file_path);
  }
  if (filePaths.length > 0) {
    await supabase.storage.from(SOURCE_BUCKET).remove(filePaths);
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
    .select("id, title, teacher_id, district_id, school_id, rubric_file_path")
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

  // Remove uploaded source files before the assignment cascade (best-effort).
  const { data: srcFiles } = await admin
    .from("assignment_sources")
    .select("source_file_path")
    .eq("assignment_id", assignmentId);
  const filePaths = (srcFiles ?? [])
    .map((r) => r.source_file_path)
    .filter((p): p is string => !!p);
  // The attached rubric document lives in the same bucket — sweep it too.
  // Scoped to the OWNING teacher, not the caller: an admin may run this, and
  // the file belongs to whoever authored the assignment. This runs on the
  // service-role client, which bypasses storage RLS, so the check is the only
  // thing standing between a stray column value and another user's object.
  if (
    assignment.rubric_file_path &&
    isRubricFilePathForTeacher(
      assignment.rubric_file_path,
      assignment.school_id,
      assignment.teacher_id
    )
  ) {
    filePaths.push(assignment.rubric_file_path);
  }
  if (filePaths.length > 0) {
    await admin.storage.from(SOURCE_BUCKET).remove(filePaths);
  }

  const { error: assignmentErr } = await admin
    .from("assignments")
    .delete()
    .eq("id", assignmentId);
  if (assignmentErr) {
    return { error: `Failed to delete assignment: ${assignmentErr.message}` };
  }

  // Append-only audit trail of this privileged, destructive action.
  await writeAuditLog({
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
    .select(
      "released_at, title, prompt, due_at, assignment_class_periods ( class_period_id )"
    )
    .eq("id", assignmentId)
    .eq("teacher_id", profile.id)
    .maybeSingle();

  if (!existing) return { error: "Assignment not found." };
  if (existing.released_at) return { error: "Already published." };
  if (!existing.title.trim() || !existing.prompt.trim()) {
    return { error: "Save a title and prompt before publishing." };
  }
  if (!existing.due_at) {
    return { error: "Set a due date before publishing." };
  }
  // Publishing is what makes students able to see this, and the junction is
  // the only thing that decides which students those are — an assignment with
  // no periods would release to nobody.
  const periodCount = (
    existing as unknown as {
      assignment_class_periods?: { class_period_id: string }[];
    }
  ).assignment_class_periods?.length;
  if (!periodCount) {
    return { error: "Pick at least one class period before publishing." };
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
