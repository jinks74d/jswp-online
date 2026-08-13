/**
 * Card surface for a single assignment in the student's list views.
 * Renders title, mode, due-date copy, and status badge. Click anywhere
 * on the card → navigates to /student/assignments/[id].
 */

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { StatusBadge } from "./status-badge";
import type { StudentAssignmentListItem } from "@/lib/queries/student-assignments";
import type { FeedbackSummary } from "@/lib/queries/teacher-feedback";

const MODE_LABELS: Record<StudentAssignmentListItem["mode"], string> = {
  expository: "Expository",
  argumentation: "Argumentation",
  literary: "Literary Analysis",
  narrative: "Narrative",
};

interface DueCopy {
  text: string;
  tone: "neutral" | "warning" | "danger";
}

function dueCopy(item: StudentAssignmentListItem, now = new Date()): DueCopy | null {
  // For finished work, swap due-date for submitted/graded info.
  if (item.status === "submitted" && item.writing?.submitted_at) {
    return {
      text: `Submitted ${formatShortDate(item.writing.submitted_at)}`,
      tone: "neutral",
    };
  }
  if (item.status === "graded" && item.writing) {
    if (item.writing.total_score !== null) {
      return {
        text: `Score: ${item.writing.total_score}`,
        tone: "neutral",
      };
    }
    if (item.writing.graded_at) {
      return {
        text: `Graded ${formatShortDate(item.writing.graded_at)}`,
        tone: "neutral",
      };
    }
  }

  if (!item.due_at) return null;

  // due_at is a calendar-only date stored as UTC midnight — compare calendar
  // days in UTC so "today"/"overdue" don't shift by a day in the viewer's tz.
  const due = new Date(item.due_at);
  const dayMs = 24 * 60 * 60 * 1000;
  const dueDay = Date.UTC(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate()
  );
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const days = Math.round((dueDay - today) / dayMs);

  if (days < 0) {
    return { text: "Overdue", tone: "danger" };
  }
  if (days === 0) {
    return { text: "Due today", tone: "warning" };
  }

  return { text: `Due in ${days} ${days === 1 ? "day" : "days"}`, tone: "neutral" };
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * The feedback line, or null when there is nothing to say.
 *
 * Deliberately NOT gated on status. Per-step grading means a teacher marks
 * individual steps without returning or grading the whole writing, so real
 * feedback routinely sits on an `in_progress` or `submitted` writing — and
 * gating on returned/graded made exactly that feedback invisible, which is the
 * bug this fixes.
 *
 * Showing it is safe: section notes save on blur, not per keystroke, so a
 * stored note is a finished thought rather than a half-typed draft.
 *
 * "New Feedback" is keyed on the UNRESOLVED count — the closest honest proxy
 * for unread, since nothing tracks reads. Once the student has worked through
 * everything the line stays, but stops claiming to be new: on graded work the
 * notes are the point, and using the unresolved count there would make them
 * vanish from the card the moment they were ticked off.
 */
function feedbackLine(
  item: StudentAssignmentListItem,
  feedback: FeedbackSummary | null
): string | null {
  if (!feedback || feedback.total === 0) {
    // A returned writing carries a teacher's intent even with no written note.
    return item.status === "returned" ? "Feedback waiting" : null;
  }

  if (feedback.unresolved > 0) {
    const n = feedback.unresolved;
    return `New Feedback · ${n} ${n === 1 ? "item" : "items"}`;
  }

  if (item.status === "returned") {
    return "All feedback addressed — re-submit when ready";
  }

  const n = feedback.total;
  return `Teacher feedback · ${n} ${n === 1 ? "note" : "notes"}`;
}

export function AssignmentCard({
  item,
  feedback = null,
}: {
  item: StudentAssignmentListItem;
  /** Feedback tallies for this assignment's writing, when it has any. */
  feedback?: FeedbackSummary | null;
}) {
  const due = dueCopy(item);

  const dueClass =
    due?.tone === "danger"
      ? "text-red-700 font-medium"
      : due?.tone === "warning"
        ? "text-amber-800 font-medium"
        : "text-gray-600";

  const feedbackText = feedbackLine(item, feedback);
  // Unread feedback is a call to action wherever it sits; once worked through
  // it settles back to a quieter "here's what your teacher said".
  const feedbackTone =
    feedback && feedback.unresolved > 0 ? "text-blue-700" : "text-green-800";

  return (
    <Link
      href={`/student/assignments/${item.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            {MODE_LABELS[item.mode]}
          </div>
          <h3 className="mt-1 text-base font-semibold text-gray-900 truncate">
            {item.title}
          </h3>
          {due && (
            <div className={`mt-1 text-sm ${dueClass}`}>{due.text}</div>
          )}
          {feedbackText && (
            <div
              className={`mt-1.5 inline-flex items-center gap-1 text-xs ${feedbackTone}`}
            >
              <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
              {feedbackText}
            </div>
          )}
        </div>
        <StatusBadge status={item.status} />
      </div>
    </Link>
  );
}
