"use client";

/**
 * Pick the class periods an assignment goes to, with an optional per-class due
 * date (migration 0050). Controlled by the parent, which serializes the value
 * into a hidden `class_periods` input for the server action.
 *
 * Checkboxes rather than `<select multiple>`: multi-selects are hostile to
 * keyboard and touch users (ctrl-click to add, and a stray plain click wipes
 * the whole selection), and there is nowhere to hang a per-row date field.
 *
 * A blank date means "use the assignment's due date". That is stored as NULL
 * rather than a copy of the default, so later editing the default still moves
 * every class that never set its own — see lib/assignment-due-dates.ts.
 */

import { CalendarClock, TriangleAlert, X } from "lucide-react";
import type { AssignmentPeriodSelection } from "@/lib/assignment-due-dates";

export type ClassPeriodOption = { id: string; label: string };

export function ClassPeriodSelect({
  options,
  value,
  onChange,
  /** Published assignments are additive-only: existing periods can't be dropped. */
  published = false,
  /** Shown as the placeholder on each row's date field. */
  defaultDueAt,
  /** Periods already saved — the ones publish locks. */
  lockedPeriodIds,
  /**
   * Labels for saved periods, keyed by id. Used to name a period that has
   * dropped out of `options`, which by definition has no label there.
   */
  savedPeriodLabels,
  error,
}: {
  options: readonly ClassPeriodOption[];
  value: readonly AssignmentPeriodSelection[];
  onChange: (next: AssignmentPeriodSelection[]) => void;
  published?: boolean;
  defaultDueAt?: string;
  lockedPeriodIds?: readonly string[];
  savedPeriodLabels?: Readonly<Record<string, string>>;
  error?: string;
}) {
  const locked = new Set(lockedPeriodIds ?? []);
  const selectedById = new Map(value.map((v) => [v.class_period_id, v]));

  // Periods this assignment still points at that the teacher no longer
  // teaches — an admin unassigned them from the class after the assignment
  // was authored. They cannot appear in `options`, but they ARE still posted
  // in the hidden field, and the server refuses the whole save because of
  // them. Rendering them is what makes the form recoverable: without a row
  // there is no control to clear, so the assignment becomes permanently
  // unsaveable and the teacher cannot see why.
  const optionIds = new Set(options.map((o) => o.id));
  const orphans = value.filter((v) => !optionIds.has(v.class_period_id));

  function removeOrphan(id: string) {
    onChange(value.filter((v) => v.class_period_id !== id));
  }

  function toggle(id: string, checked: boolean) {
    if (checked) {
      if (selectedById.has(id)) return;
      onChange([...value, { class_period_id: id, due_at: "" }]);
    } else {
      onChange(value.filter((v) => v.class_period_id !== id));
    }
  }

  function setDue(id: string, due: string) {
    onChange(
      value.map((v) =>
        v.class_period_id === id ? { ...v, due_at: due } : v
      )
    );
  }

  return (
    <fieldset className="space-y-2">
      <legend className="block text-sm font-medium text-gray-700 mb-1.5">
        Class Periods or Blocks
      </legend>

      {options.length === 0 ? (
        <p className="text-xs text-amber-700">
          You&apos;re not assigned to any class periods yet — ask your admin to
          assign you to a class before publishing.
        </p>
      ) : (
        <>
          <p className="text-xs text-gray-600">
            Pick every class that gets this assignment. Leave a date blank to
            use the due date above.
          </p>

          <ul className="space-y-1.5">
            {options.map((opt) => {
              const selection = selectedById.get(opt.id);
              const checked = selection !== undefined;
              const isLocked = published && locked.has(opt.id);
              const dueFieldId = `period-due-${opt.id}`;

              return (
                <li
                  key={opt.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-gray-200 px-3 py-2"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      // Unchecking a locked period would revoke access for
                      // students who may already have work in progress. The
                      // server ignores such a removal either way; disabling
                      // the box is how the teacher finds that out before
                      // saving rather than after.
                      disabled={isLocked}
                      onChange={(e) => toggle(opt.id, e.target.checked)}
                      className="text-blue-600 focus:ring-blue-500 disabled:opacity-60"
                    />
                    <span className="font-medium text-gray-900">
                      {opt.label}
                    </span>
                  </label>

                  {isLocked && (
                    <span className="text-xs text-gray-500">
                      Published to this class
                    </span>
                  )}

                  {checked && (
                    <span className="ml-auto flex items-center gap-2">
                      <CalendarClock
                        className="w-3.5 h-3.5 text-gray-500"
                        aria-hidden
                      />
                      <label
                        htmlFor={dueFieldId}
                        className="text-xs text-gray-600"
                      >
                        Due
                      </label>
                      <input
                        id={dueFieldId}
                        type="date"
                        value={selection?.due_at ?? ""}
                        onChange={(e) => setDue(opt.id, e.target.value)}
                        placeholder={defaultDueAt}
                        aria-label={`Due date for ${opt.label} — leave blank to use the assignment due date`}
                        className="px-2 py-1 border border-stone-400 rounded text-sm text-gray-900"
                      />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {orphans.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 space-y-2">
          <p className="flex items-start gap-2 text-xs text-amber-900">
            <TriangleAlert
              className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
              aria-hidden="true"
            />
            <span>
              {orphans.length === 1 ? "A class" : `${orphans.length} classes`} on
              this assignment {orphans.length === 1 ? "is" : "are"} no longer
              assigned to you, so {orphans.length === 1 ? "it" : "they"} can
              &apos;t be shown above. Remove{" "}
              {orphans.length === 1 ? "it" : "them"} here to save your changes,
              or ask an admin to add you back to the class.
            </span>
          </p>

          <ul className="space-y-1.5">
            {orphans.map((o) => (
              <li
                key={o.class_period_id}
                className="flex items-center gap-3 rounded border border-amber-200 bg-white px-3 py-1.5"
              >
                <span className="text-sm text-gray-700">
                  {savedPeriodLabels?.[o.class_period_id] ?? "Unknown class"}
                </span>
                <button
                  type="button"
                  // Safe even when published: the published save path only
                  // ever upserts periods, so dropping this row omits it from
                  // the upsert without deleting the existing row — students
                  // in that class keep their access and their work.
                  onClick={() => removeOrphan(o.class_period_id)}
                  className="ml-auto inline-flex items-center gap-1 rounded border border-amber-400 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {published && (
        <p className="text-xs text-gray-500">
          You can add a class to a published assignment, but not remove one —
          students there may already have work in progress. Unpublish to change
          that.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  );
}
