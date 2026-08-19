/**
 * District analytics read queries.
 *
 * Unlike lib/queries/district-dashboard.ts, which is RLS-scoped to the
 * caller's own district, everything here goes through the RPCs added in
 * migration 0061. Those are SECURITY DEFINER and gate on
 * `auth_user_can_view_district()`, which admits both district admins and
 * holders of a `district_access_grants` row — the multi-district analytics
 * viewer.
 *
 * Consequence worth stating plainly: the districtId passed in here is NOT
 * validated by this module, and does not need to be. The database rejects a
 * district the caller cannot view, raising SQLSTATE 42501. Do not add a
 * redundant check in the page layer and do not remove the one in the RPC.
 *
 * The RPCs return numerators and denominators, never percentages. Rates are
 * computed here via rate(), which returns null rather than NaN on a zero
 * denominator so the UI can render "—" instead of a fake zero.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import type { JswpMode } from "@/lib/jswp-modes";
import { deriveFunnel, type DistrictStepFunnel } from "@/lib/district-funnel";

// Re-exported so callers have one import for the whole feature; the split
// exists only because this module is server-only and the funnel maths must
// stay reachable from the jsdom unit suite.
export { rate, type DistrictStepFunnel, type StepFunnelPoint } from "@/lib/district-funnel";

/* ─── The metric set ──────────────────────────────────────────────────── */

/**
 * One district's analytics summary. Aggregates only — by design this type can
 * never carry a student name, a writing id, or writing content. See migration
 * 0061 §6 for why that constraint is what keeps the feature from having to
 * widen any existing RLS policy.
 *
 * Field groups mirror the four questions the metrics answer: did they turn it
 * on, do students finish, are they teaching the whole method, and do teachers
 * close the loop.
 *
 * Every numerator ships with its denominator rather than a precomputed
 * percentage — the UI divides via rate(). This view exists to compare four
 * districts of different sizes, where "67%" over three writings and "67%"
 * over three hundred are not the same claim.
 */
export type DistrictAnalytics = {
  districtId: string;
  districtName: string;
  window: { since: string; until: string };

  /** Denominators. Kept beside every rate so a 3-of-7 is visibly discountable. */
  roster: {
    schools: number;
    teachers: number;
    students: number;
  };

  /** Did the district actually turn it on? The headline pair. */
  adoption: {
    teachersActive: number;
    studentsActive: number;
  };

  /** Of the writings started in the window, how many reached submission. */
  completion: {
    writingsStarted: number;
    writingsCompleted: number;
  };

  /** Fidelity: is the whole method being taught, or only Expository? */
  modeMix: {
    total: number;
    expository: number;
    argumentation: number;
    literary: number;
    narrative: number;
  };

  /** Is the feedback loop closing, and how fast. */
  feedback: {
    writingsGraded: number;
    /** Median, not mean — one six-month-late grade would wreck an average. */
    medianDaysToFeedback: number | null;
  };

  /**
   * Revision is the pedagogy, not an exception to it. Knowable only since
   * 0060; before it, a resubmit overwrote the evidence of the first submit.
   */
  revision: {
    writingsSubmitted: number;
    writingsRevised: number;
  };
};

/* ─── Reads ───────────────────────────────────────────────────────────── */

/** Default window. Long enough to cover a grading period, short enough that
 *  a district that stopped using the app two terms ago reads as inactive. */
const DEFAULT_WINDOW_DAYS = 90;

export type AnalyticsWindow = { since: Date; until: Date };

export function defaultWindow(): AnalyticsWindow {
  const until = new Date();
  const since = new Date(until.getTime() - DEFAULT_WINDOW_DAYS * 86_400_000);
  return { since, until };
}

/**
 * Analytics for one district.
 *
 * Takes districtId explicitly rather than reading it off the caller's profile
 * — the same shape as getDistrictStats() in district-dashboard.ts. That is
 * what makes the multi-district case free: a viewer with four grants calls
 * this four times with four ids and nothing else changes.
 *
 * Throws if the caller cannot view the district. The RPC raises 42501 rather
 * than returning an empty row, so an unauthorized read surfaces as an error
 * instead of a plausible-looking dashboard full of zeroes.
 */
export async function getDistrictAnalytics(
  districtId: string,
  window: AnalyticsWindow = defaultWindow()
): Promise<DistrictAnalytics | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .rpc("get_district_analytics", {
      p_district_id: districtId,
      p_since: window.since.toISOString(),
      p_until: window.until.toISOString(),
    })
    .single();

  if (error) {
    throw new Error(
      `Failed to load analytics for district ${districtId}: ${error.message}`
    );
  }
  // Zero rows for a district id that does not exist; .single() surfaces that
  // as data === null rather than an error.
  if (!data) return null;

  return {
    districtId: data.district_id,
    districtName: data.district_name,
    window: { since: data.window_since, until: data.window_until },
    roster: {
      schools: data.schools,
      teachers: data.teachers,
      students: data.students,
    },
    adoption: {
      teachersActive: data.teachers_active,
      studentsActive: data.students_active,
    },
    completion: {
      writingsStarted: data.writings_started,
      writingsCompleted: data.writings_completed,
    },
    modeMix: {
      total: data.assignments_total,
      expository: data.assignments_expository,
      argumentation: data.assignments_argumentation,
      literary: data.assignments_literary,
      narrative: data.assignments_narrative,
    },
    feedback: {
      writingsGraded: data.writings_graded,
      medianDaysToFeedback: data.median_days_to_feedback,
    },
    revision: {
      writingsSubmitted: data.writings_submitted,
      writingsRevised: data.writings_revised,
    },
  };
}

/**
 * Per-mode step funnels for one district. One entry per mode that has any
 * writings in the window — a mode nobody assigned produces no funnel rather
 * than an all-zero one.
 */
export async function getDistrictStepFunnels(
  districtId: string,
  window: AnalyticsWindow = defaultWindow()
): Promise<readonly DistrictStepFunnel[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc("get_district_step_funnel", {
    p_district_id: districtId,
    p_since: window.since.toISOString(),
    p_until: window.until.toISOString(),
  });

  if (error) {
    throw new Error(
      `Failed to load step funnel for district ${districtId}: ${error.message}`
    );
  }

  const byMode = new Map<JswpMode, { counts: Map<string, number>; total: number }>();
  for (const row of data ?? []) {
    let entry = byMode.get(row.mode);
    if (!entry) {
      entry = { counts: new Map(), total: row.mode_writings_total };
      byMode.set(row.mode, entry);
    }
    entry.counts.set(row.step_key, row.writings_reached);
  }

  return [...byMode.entries()].map(([mode, { counts, total }]) =>
    deriveFunnel(mode, counts, total)
  );
}

/**
 * Every district the current user may view, for the district switcher.
 *
 * Reads `district_access_grants` directly rather than through an RPC. The
 * `district_access_grants_read_self` policy (0061 §5) already restricts this
 * to the caller's own rows, so RLS is doing the scoping and a SECURITY
 * DEFINER wrapper would only add a second place for the rule to live.
 *
 * Returns [] for a district admin — they hold no grants, and their single
 * district comes from their profile as it always has.
 */
export async function listViewableDistricts(): Promise<
  readonly { id: string; name: string }[]
> {
  const supabase = await createServerClient();

  // Two round trips rather than a `districts(id, name)` embedded join. The
  // hand-maintained database.types.ts declares `Relationships: []` for all 30
  // tables, so PostgREST embedding does not type-check here — and no other
  // module in lib/queries/ embeds either.
  const grants = await supabase
    .from("district_access_grants")
    .select("district_id")
    .order("created_at", { ascending: true });

  if (grants.error) {
    throw new Error(`Failed to load district grants: ${grants.error.message}`);
  }

  const ids = (grants.data ?? []).map((row) => row.district_id);
  if (ids.length === 0) return [];

  const districts = await supabase
    .from("districts")
    .select("id, name")
    .in("id", ids)
    .order("name", { ascending: true });

  if (districts.error) {
    throw new Error(
      `Failed to load viewable districts: ${districts.error.message}`
    );
  }

  return districts.data ?? [];
}

/**
 * The districts to offer in the switcher for a given role.
 *
 * Super admins hold no grants — their access comes from
 * auth_user_is_admin_for_district() returning TRUE everywhere — so
 * listViewableDistricts() correctly returns [] for them and would strand them
 * on an empty page. They get the full list instead.
 *
 * The branch is a UI convenience only. It cannot widen anyone's access: the
 * RPCs re-check every district id independently, so a forged ?district= param
 * still raises 42501.
 */
export async function listSwitchableDistricts(
  role: string
): Promise<readonly { id: string; name: string }[]> {
  if (role === "super_admin") {
    const { listDistricts } = await import("@/lib/queries/districts");
    const all = await listDistricts();
    return all.map((d) => ({ id: d.id, name: d.name }));
  }
  return listViewableDistricts();
}

/**
 * Analytics for several districts at once, for the side-by-side comparison
 * view. Fetched concurrently — each RPC call re-checks authorization
 * independently, so a caller cannot widen their scope by batching.
 */
export async function getDistrictAnalyticsFor(
  districtIds: readonly string[],
  window: AnalyticsWindow = defaultWindow()
): Promise<readonly DistrictAnalytics[]> {
  const results = await Promise.all(
    districtIds.map((id) => getDistrictAnalytics(id, window))
  );
  return results.filter((r): r is DistrictAnalytics => r !== null);
}
