/**
 * Centred overview stat — icon chip above the figure, label beneath, as a
 * <dd>/<dt> pair. Used inside the banded overview strips at the top of the
 * school Teachers and Students views, which is where it was defined twice,
 * byte for byte.
 *
 * The figure reads before the label, so <dd> deliberately precedes <dt>;
 * that is legal inside a <dl> and matches how the strip is read.
 */

import type { LucideIcon } from "lucide-react";

export function OverviewStat({
  label,
  value,
  icon: Icon,
  tint,
  accent,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Tailwind bg/text classes for the icon chip. */
  tint: string;
  /** Render the figure in the district/school brand colour. */
  accent?: boolean;
}) {
  return (
    <div className="px-6 py-6 text-center">
      <span
        className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <dd
        className={`text-2xl font-bold leading-none ${
          accent ? "text-[var(--brand)]" : "text-gray-900"
        }`}
      >
        {value}
      </dd>
      <dt className="mt-1.5 text-sm text-gray-600">{label}</dt>
    </div>
  );
}
