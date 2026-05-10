/**
 * Pill badge for the teacher's view of a student writing's status.
 * Different vocabulary from the student-side StatusBadge — the
 * student sees "Needs Revision" for `returned` (their POV), the
 * teacher sees "Returned" (theirs).
 *
 * Pure render, no client logic.
 */

import type { Database } from "@/lib/database.types";

type WritingStatus = Database["public"]["Enums"]["jswp_writing_status"];

const LABELS: Record<WritingStatus, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  submitted: "Submitted",
  returned: "Returned",
  graded: "Graded",
};

const STYLES: Record<WritingStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-800",
  submitted: "bg-amber-100 text-amber-900",
  returned: "bg-blue-100 text-blue-800",
  graded: "bg-green-100 text-green-800",
};

export function TeacherStatusBadge({ status }: { status: WritingStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}

export function teacherStatusLabel(status: WritingStatus): string {
  return LABELS[status];
}
