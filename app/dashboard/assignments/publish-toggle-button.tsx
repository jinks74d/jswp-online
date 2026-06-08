"use client";

/**
 * Row-level publish/unpublish toggle for the My Assignments list. Calls the
 * publishAssignment / unpublishAssignment server actions (which redirect or
 * revalidate). Unpublish is always permitted; when students have started
 * writing, the confirm dialog warns that they'll temporarily lose access.
 * Publish may be rejected server-side (missing title/prompt/class period) —
 * that friendly error surfaces via an alert.
 */

import { useActionState, useEffect } from "react";
import { Loader2, Send, Undo2 } from "lucide-react";
import {
  publishAssignment,
  unpublishAssignment,
  type AssignmentFormState,
} from "@/lib/actions/assignments";

export function PublishToggleButton({
  assignmentId,
  title,
  published,
  studentWritingCount,
}: {
  assignmentId: string;
  title: string;
  published: boolean;
  studentWritingCount: number;
}) {
  const [state, formAction, pending] = useActionState(
    published ? unpublishAssignment : publishAssignment,
    {} as AssignmentFormState
  );

  useEffect(() => {
    if (state?.error) window.alert(state.error);
  }, [state]);

  const label = title || "this assignment";
  const confirmMessage = !published
    ? `Publish "${label}"? Students will be able to see it and start writing.`
    : studentWritingCount > 0
      ? `Unpublish "${label}"? ${studentWritingCount} student${
          studentWritingCount === 1 ? "" : "s"
        } ${
          studentWritingCount === 1 ? "has" : "have"
        } already started writing and will TEMPORARILY lose access until you publish again. Their work is not deleted. Continue?`
      : `Unpublish "${label}"? Students won't see it until you publish again.`;

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
      className="inline-flex"
    >
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <button
        type="submit"
        disabled={pending}
        title={published ? "Unpublish" : "Publish"}
        aria-label={`${published ? "Unpublish" : "Publish"} ${label}`}
        className="inline-flex items-center justify-center p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : published ? (
          <Undo2 className="w-4 h-4" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </button>
    </form>
  );
}
