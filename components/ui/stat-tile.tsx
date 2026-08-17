/**
 * Iconless stat tile — an uppercase term over a large figure, as a <dt>/<dd>
 * pair. Callers wrap a row of these in a <dl>.
 *
 * Previously defined twice under app/admin/districts: once as `StatTile` on
 * the index and once as `StatCard` on the detail page. Same markup, two names.
 *
 * `accent` is still rose-600 rather than var(--brand). Both original copies
 * hardcoded it, and switching now would be a visual change riding along with
 * a refactor. Centralising it here is the point: the brand-token sweep in
 * docs/BACKLOG.md becomes a one-line edit to this file.
 */

export function StatTile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  /** Render the figure in the accent colour rather than near-black. */
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd
        className={`mt-1 truncate text-3xl font-bold ${
          accent ? "text-rose-600" : "text-gray-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
