import type { Metadata } from "next";
/**
 * /analytics — cross-district program analytics for the district_analyst
 * role, and for super admins (0061).
 *
 * The selected district comes from ?district=. It is deliberately NOT
 * validated here: get_district_analytics() re-checks authorization against
 * the caller's grants and raises SQLSTATE 42501, so a hand-typed id for a
 * district the viewer has no grant on throws rather than rendering. Adding a
 * check here would put the rule in two places, which is the pattern §14.4
 * exists to prevent.
 */

import { BarChart3 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { EmptyState } from "@/components/ui/empty-state";
import { DistrictSwitcher } from "@/components/analytics/district-switcher";
import {
  AdoptionPanel,
  FeedbackPanel,
  ModeMixPanel,
  StepFunnelPanel,
} from "@/components/analytics/metric-panels";
import {
  defaultWindow,
  getDistrictAnalytics,
  getDistrictStepFunnels,
  listSwitchableDistricts,
} from "@/lib/queries/district-analytics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Program Analytics" };

type SearchParams = Promise<{ district?: string }>;

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireRole(["district_analyst", "super_admin"]);
  const { district: requested } = await searchParams;

  const districts = await listSwitchableDistricts(profile.role);

  if (districts.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No districts assigned"
        action={null}
      >
        Your account does not have analytics access to any district yet. A
        super admin can grant it.
      </EmptyState>
    );
  }

  // Fall back to the first rather than trusting the query string blindly —
  // not for security (the RPC handles that) but so a stale bookmark to a
  // revoked district lands on something usable instead of a 42501.
  const selectedId =
    requested && districts.some((d) => d.id === requested)
      ? requested
      : districts[0].id;

  const window = defaultWindow();
  const [analytics, funnels] = await Promise.all([
    getDistrictAnalytics(selectedId, window),
    getDistrictStepFunnels(selectedId, window),
  ]);

  if (!analytics) {
    return (
      <EmptyState icon={BarChart3} title="District not found" action={null}>
        That district no longer exists.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <DistrictSwitcher districts={districts} selectedId={selectedId} />
        <p className="text-sm text-gray-600">
          {dateFmt.format(new Date(analytics.window.since))} –{" "}
          {dateFmt.format(new Date(analytics.window.until))}
        </p>
      </div>

      <AdoptionPanel a={analytics} />

      <div className="grid gap-8 lg:grid-cols-2">
        <ModeMixPanel a={analytics} />
        <FeedbackPanel a={analytics} />
      </div>

      <StepFunnelPanel funnels={funnels} />
    </div>
  );
}
