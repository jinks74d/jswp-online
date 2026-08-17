/**
 * Empty-state panel for the teacher dashboard — muted icon, heading,
 * explanatory copy, and an optional call to action.
 *
 * Four copies of this shell lived in app/dashboard (classes, students,
 * assignments, and an assignment's writings). They differed only in icon,
 * wording and CTA, all of which are props now.
 *
 * `action` is a ReactNode rather than a href/label pair on purpose: the four
 * call sites use visually different CTAs (a filled button, a plain text link,
 * none at all), and flattening those into one styled control would be a
 * design change rather than a refactor. Each keeps its own.
 *
 * Scoped to the teacher dashboard's stone-bordered surface. The student
 * portal and the district Classes view have their own empty states with
 * different chrome; they are intentionally not folded in here.
 */

import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  /** Explanatory copy beneath the heading. */
  children: React.ReactNode;
  /** Optional CTA, rendered below the copy with its own styling. */
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-8 text-center">
      <Icon className="w-10 h-10 text-gray-400 mx-auto mb-4" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-stone-600 mt-2 max-w-md mx-auto">{children}</p>
      {action}
    </div>
  );
}
