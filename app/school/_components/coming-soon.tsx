/**
 * Placeholder for school sidebar sections that don't have pages yet. Keeps every
 * nav target routable while the real feature is built.
 */

import { Construction, type LucideIcon } from "lucide-react";

export function ComingSoon({
  title,
  description,
  icon: Icon = Construction,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      </header>

      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="text-sm font-semibold text-gray-700">Coming soon</p>
        <p className="max-w-sm text-sm text-gray-500">
          This section isn’t built yet. It’s on the roadmap for the school admin
          area.
        </p>
      </div>
    </div>
  );
}
