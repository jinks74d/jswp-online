/**
 * Pill badge for the five derived student-writing statuses. Pure render,
 * no client logic. Color stays consistent with how the same status is
 * shown on the detail page so students learn the visual mapping.
 */

import type { DerivedStatus } from "@/lib/queries/student-assignments";

const LABELS: Record<DerivedStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  submitted: "Submitted",
  returned: "Needs Revision",
  graded: "Graded",
};

const STYLES: Record<DerivedStatus, string> = {
  not_started: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-800",
  submitted: "bg-green-100 text-green-800",
  returned: "bg-amber-100 text-amber-900",
  graded: "bg-violet-100 text-violet-800",
};

export function StatusBadge({ status }: { status: DerivedStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}

export function statusLabel(status: DerivedStatus): string {
  return LABELS[status];
}
