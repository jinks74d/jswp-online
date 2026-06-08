"use client";

/**
 * Row-level delete control for the My Assignments list. Wraps the existing
 * deleteAssignment server action (which guards: drafts only, and refuses if
 * students have started writing). Confirms before submitting and surfaces the
 * action's friendly error via an alert; on success the action redirects.
 */

import { useActionState, useEffect } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  deleteAssignment,
  type AssignmentFormState,
} from "@/lib/actions/assignments";

export function DeleteAssignmentButton({
  assignmentId,
  title,
}: {
  assignmentId: string;
  title: string;
}) {
  const [state, formAction, pending] = useActionState(
    deleteAssignment,
    {} as AssignmentFormState
  );

  useEffect(() => {
    if (state?.error) window.alert(state.error);
  }, [state]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Delete "${title || "this assignment"}"? This can't be undone.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <button
        type="submit"
        disabled={pending}
        title="Delete"
        aria-label={`Delete ${title || "assignment"}`}
        className="inline-flex items-center justify-center p-1.5 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </button>
    </form>
  );
}
