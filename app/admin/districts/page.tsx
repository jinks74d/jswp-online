/**
 * /admin/districts — super-admin district management, redesigned as a grid of
 * branded "tenant cards". A quiet stats strip rolls up the platform totals; the
 * client <DistrictsBrowser> owns search/sort + the card grid; the client
 * <NewDistrictPanel> owns the create/import slide-over. Super-admin-only (the
 * admin layout gates to all three admin roles, so this page re-gates).
 */

import { requireRole } from "@/lib/auth";
import { listDistrictsOverview } from "@/lib/queries/districts";
import { DistrictsBrowser } from "./districts-browser";
import { NewDistrictPanel } from "./new-district-panel";

export const dynamic = "force-dynamic";

export default async function DistrictsPage() {
  await requireRole("super_admin");

  const overview = await listDistrictsOverview();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Districts</h1>
          <p className="text-gray-600">
            Every district on the platform. Create one to begin onboarding its
            schools and admins.
          </p>
        </div>
        <NewDistrictPanel />
      </header>

      <dl className="grid grid-cols-3 gap-4 sm:max-w-2xl">
        <StatTile label="Districts" value={overview.stats.total} />
        <StatTile label="Active" value={overview.stats.active} accent />
        <StatTile label="Schools" value={overview.stats.schools} />
      </dl>

      <DistrictsBrowser districts={overview.districts} />
    </div>
  );
}

function StatTile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd
        className={`mt-1 text-3xl font-bold ${
          accent ? "text-rose-600" : "text-gray-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
