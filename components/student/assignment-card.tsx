/**
 * Card surface for a single assignment in the student's list views.
 * Renders title, mode, due-date copy, and status badge. Click anywhere
 * on the card → navigates to /student/assignments/[id].
 */

import Link from "next/link";
import { StatusBadge } from "./status-badge";
import type { StudentAssignmentListItem } from "@/lib/queries/student-assignments";

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

  const due = new Date(item.due_at);
  const diffMs = due.getTime() - now.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  if (diffMs < 0) {
    return { text: "Overdue", tone: "danger" };
  }
  if (diffMs < dayMs) {
    return { text: "Due today", tone: "warning" };
  }

  const days = Math.ceil(diffMs / dayMs);
  return { text: `Due in ${days} ${days === 1 ? "day" : "days"}`, tone: "neutral" };
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function AssignmentCard({ item }: { item: StudentAssignmentListItem }) {
  const due = dueCopy(item);

  const dueClass =
    due?.tone === "danger"
      ? "text-red-700 font-medium"
      : due?.tone === "warning"
        ? "text-amber-800 font-medium"
        : "text-gray-600";

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
        </div>
        <StatusBadge status={item.status} />
      </div>
    </Link>
  );
}
