"use client";

/**
 * Teacher assignment for a class period: a list of assigned teachers (each with
 * Remove) + an "assign a teacher" picker drawn from the school's teachers not
 * already on the period. The first teacher assigned becomes the primary.
 */

import { useActionState } from "react";
import { Loader2, UserPlus, X } from "lucide-react";
import {
  assignTeacher,
  unassignTeacher,
  type AssignmentState,
} from "@/lib/actions/class-periods";
import type { AssignedTeacher } from "@/lib/queries/class-periods-admin";
import type { SchoolUserRow } from "@/lib/queries/school-users";

const initialState: AssignmentState = {};

export function TeacherAssignment({
  periodId,
  assigned,
  schoolTeachers,
}: {
  periodId: string;
  assigned: readonly AssignedTeacher[];
  schoolTeachers: readonly SchoolUserRow[];
}) {
  const [assignS, assignA, assigning] = useActionState(
    assignTeacher,
    initialState
  );
  const [removeS, removeA] = useActionState(unassignTeacher, initialState);

  const assignedIds = new Set(assigned.map((a) => a.teacher_id));
  const available = schoolTeachers.filter((t) => !assignedIds.has(t.id));

  const name = (t: { first_name: string | null; last_name: string | null; email: string | null }) =>
    [t.first_name, t.last_name].filter(Boolean).join(" ") || t.email || "—";

  return (
    <div className="space-y-3">
      {(assignS.error || removeS.error) && (
        <p className="text-sm text-red-600" role="alert">
          {assignS.error || removeS.error}
        </p>
      )}

      <ul className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-lg">
        {assigned.map((t) => (
          <li key={t.teacher_id} className="flex items-center justify-between px-4 py-2">
            <span className="text-sm text-gray-900">
              {name(t)}
              {t.is_primary && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  primary
                </span>
              )}
            </span>
            <form action={removeA}>
              <input type="hidden" name="period_id" value={periodId} />
              <input type="hidden" name="teacher_id" value={t.teacher_id} />
              <button
                type="submit"
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-700"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                Remove
              </button>
            </form>
          </li>
        ))}
        {assigned.length === 0 && (
          <li className="px-4 py-3 text-sm text-gray-500">
            No teachers assigned yet.
          </li>
        )}
      </ul>

      {available.length > 0 ? (
        <form action={assignA} className="flex items-center gap-2">
          <input type="hidden" name="period_id" value={periodId} />
          <select
            name="teacher_id"
            required
            defaultValue=""
            aria-label="Teacher to assign"
            className="flex-1 px-3 py-2 border border-gray-400 rounded-md text-sm text-gray-900"
          >
            <option value="" disabled>
              Choose a teacher…
            </option>
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {name(t)} {t.email ? `· ${t.email}` : ""}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={assigning}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {assigning ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <UserPlus className="w-4 h-4" aria-hidden="true" />
            )}
            Assign
          </button>
        </form>
      ) : (
        <p className="text-xs text-gray-500">
          {schoolTeachers.length === 0
            ? "No teachers at this school yet — add teachers first."
            : "All school teachers are already assigned."}
        </p>
      )}
    </div>
  );
}
