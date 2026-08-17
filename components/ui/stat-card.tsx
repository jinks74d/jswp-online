/**
 * Horizontal stat card — tinted icon chip beside a label and a count.
 *
 * This shape had been redefined locally in seven files across four route
 * trees (admin/users, district/users, district/classes, school/assignments,
 * school/students, school/teachers, school/classes). Five were byte-identical
 * and two used a roomier scale, which is the only real difference and is now
 * the `size` prop.
 *
 * `tint` carries the icon chip's colour as Tailwind classes — usually a
 * bg/text pair like "bg-emerald-50 text-emerald-600", or the brand tokens
 * "bg-[var(--brand-soft)] text-[var(--brand)]". It stays a caller-supplied
 * string rather than a closed enum because the palette differs per surface,
 * and several call sites still pass hardcoded colours that a later sweep will
 * move onto --brand (docs/BACKLOG.md).
 */

import type { LucideIcon } from "lucide-react";

/** "sm" is the compact card (five original call sites); "md" the roomier one. */
export type StatCardSize = "sm" | "md";

const SIZES: Record<StatCardSize, { row: string; chip: string }> = {
  sm: { row: "gap-3 p-4", chip: "h-10 w-10" },
  md: { row: "gap-3.5 p-5", chip: "h-11 w-11" },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tint,
  size = "sm",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Tailwind bg/text classes for the icon chip. */
  tint: string;
  size?: StatCardSize;
}) {
  const s = SIZES[size];

  return (
    <div
      className={`flex items-center rounded-xl border border-gray-200 bg-white shadow-sm ${s.row}`}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg ${s.chip} ${tint}`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      {/* min-w-0 lets the label actually truncate instead of forcing the
          card wider than its grid track. */}
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </p>
        <p className="text-2xl font-bold leading-tight text-gray-900">{value}</p>
      </div>
    </div>
  );
}
