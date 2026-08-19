"use client";

/**
 * District switcher for the cross-district analytics view (0061).
 *
 * A plain <select> that pushes ?district=<id>. Not a custom dropdown: the
 * native control is keyboard- and screenreader-correct for free, and the list
 * is four entries, not four hundred.
 *
 * The options are only what the server already resolved from the caller's
 * grants. Tampering with the value gains nothing — get_district_analytics()
 * re-checks authorization per district id and raises 42501 — so this is a
 * navigation control, not an access control.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function DistrictSwitcher({
  districts,
  selectedId,
}: {
  districts: readonly { id: string; name: string }[];
  selectedId: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  // One district is not a choice — render it as a heading rather than a
  // control that cannot do anything.
  if (districts.length <= 1) {
    return (
      <h1 className="text-2xl font-bold text-gray-900">
        {districts[0]?.name ?? "No district"}
      </h1>
    );
  }

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(params.toString());
    next.set("district", event.target.value);
    startTransition(() => router.push(`/analytics?${next.toString()}`));
  }

  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor="district-switcher"
        className="text-sm font-semibold text-gray-700"
      >
        District
      </label>
      {/* border-gray-500, not 300/400 — SC 1.4.11 wants 3:1 for a control's
          boundary and only gray-500 clears it against white. CLAUDE.md §9. */}
      <select
        id="district-switcher"
        value={selectedId}
        onChange={onChange}
        disabled={pending}
        className="rounded-lg border border-gray-500 bg-white px-3 py-2 text-sm font-medium text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:opacity-60"
      >
        {districts.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <span aria-live="polite" className="sr-only">
        {pending ? "Loading district analytics" : ""}
      </span>
    </div>
  );
}
