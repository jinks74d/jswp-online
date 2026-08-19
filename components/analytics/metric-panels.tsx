/**
 * Presentation for the district analytics metrics (0061).
 *
 * Every figure renders as a rate with its raw fraction beneath it. That is
 * deliberate and is the whole reason the RPC returns numerators and
 * denominators rather than percentages: this view exists to compare four
 * districts of different sizes, where "67%" over three writings and "67%" over
 * three hundred are not the same claim.
 *
 * No thresholds, no red/green banding, no "needs attention" labels. What
 * counts as a healthy completion or skip rate is pedagogical judgment and
 * belongs to Dr. Louis, not to this file (CLAUDE.md §15.2). The numbers are
 * presented bare until someone who teaches the program says where the lines
 * are.
 */

import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  Timer,
  UserCheck,
  Users,
} from "lucide-react";
import type {
  DistrictAnalytics,
  DistrictStepFunnel,
} from "@/lib/queries/district-analytics";
import { rate } from "@/lib/queries/district-analytics";
import { MODES } from "@/lib/jswp-modes";

/* ─── Formatting ──────────────────────────────────────────────────────── */

/** A rate as a percentage, or an em dash when the denominator was zero. */
function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function RateStat({
  label,
  icon: Icon,
  numerator,
  denominator,
  denominatorLabel,
}: {
  label: string;
  icon: LucideIcon;
  numerator: number;
  denominator: number;
  denominatorLabel: string;
}) {
  const value = rate(numerator, denominator);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </p>
      </div>
      <p className="mt-3 text-3xl font-bold leading-none text-gray-900">
        {pct(value)}
      </p>
      {/* The fraction is not decoration. It is what makes a rate over a tiny
          denominator visibly discountable when four districts sit side by
          side. */}
      <p className="mt-1.5 text-sm text-gray-600">
        {numerator.toLocaleString()} of {denominator.toLocaleString()}{" "}
        {denominatorLabel}
      </p>
    </div>
  );
}

/* ─── Panels ──────────────────────────────────────────────────────────── */

export function AdoptionPanel({ a }: { a: DistrictAnalytics }) {
  return (
    <section aria-labelledby="adoption-heading">
      <h2
        id="adoption-heading"
        className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-700"
      >
        Adoption
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RateStat
          label="Active teachers"
          icon={UserCheck}
          numerator={a.adoption.teachersActive}
          denominator={a.roster.teachers}
          denominatorLabel="teachers"
        />
        <RateStat
          label="Active students"
          icon={Users}
          numerator={a.adoption.studentsActive}
          denominator={a.roster.students}
          denominatorLabel="students"
        />
        <RateStat
          label="Completion"
          icon={CheckCircle2}
          numerator={a.completion.writingsCompleted}
          denominator={a.completion.writingsStarted}
          denominatorLabel="writings started"
        />
        <RateStat
          label="Revision"
          icon={RefreshCw}
          numerator={a.revision.writingsRevised}
          denominator={a.revision.writingsSubmitted}
          denominatorLabel="writings submitted"
        />
      </div>
    </section>
  );
}

export function FeedbackPanel({ a }: { a: DistrictAnalytics }) {
  const days = a.feedback.medianDaysToFeedback;

  return (
    <section aria-labelledby="feedback-heading">
      <h2
        id="feedback-heading"
        className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-700"
      >
        Feedback loop
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <Timer className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Median days to feedback
            </p>
          </div>
          <p className="mt-3 text-3xl font-bold leading-none text-gray-900">
            {days === null ? "—" : days}
          </p>
          <p className="mt-1.5 text-sm text-gray-600">
            across {a.feedback.writingsGraded.toLocaleString()} graded
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <ClipboardList className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Assignments released
            </p>
          </div>
          <p className="mt-3 text-3xl font-bold leading-none text-gray-900">
            {a.modeMix.total.toLocaleString()}
          </p>
          <p className="mt-1.5 text-sm text-gray-600">
            across {a.roster.schools.toLocaleString()} schools
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * Mode mix. A district teaching only Expository is teaching a quarter of the
 * program — that is the fact this panel exists to make visible, and it is
 * invisible in any count of total assignments.
 */
export function ModeMixPanel({ a }: { a: DistrictAnalytics }) {
  const rows = [
    { mode: "expository" as const, count: a.modeMix.expository },
    { mode: "argumentation" as const, count: a.modeMix.argumentation },
    { mode: "literary" as const, count: a.modeMix.literary },
    { mode: "narrative" as const, count: a.modeMix.narrative },
  ];

  return (
    <section aria-labelledby="modemix-heading">
      <h2
        id="modemix-heading"
        className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-700"
      >
        Mode coverage
      </h2>
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        {a.modeMix.total === 0 ? (
          <p className="text-sm text-gray-600">
            No assignments released in this window.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map(({ mode, count }) => {
              const share = rate(count, a.modeMix.total);
              return (
                <li key={mode}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-gray-900">
                      {MODES[mode].displayName}
                    </span>
                    <span className="text-sm tabular-nums text-gray-600">
                      {count.toLocaleString()} · {pct(share)}
                    </span>
                  </div>
                  {/* The bar duplicates the number it sits under, so it is
                      decorative and hidden from assistive tech rather than
                      read out twice. */}
                  <div
                    aria-hidden="true"
                    className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100"
                  >
                    <div
                      className="h-full rounded-full bg-rose-500"
                      style={{ width: `${(share ?? 0) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * Per-mode step funnel, with the stall step and skip rate derived in
 * lib/queries/district-analytics.ts from the step order in lib/jswp-modes.ts.
 *
 * The skip figure is the one to read closely. CLAUDE.md §14.6 and §14.7 name
 * skipping Decode the Prompt and Read & Annotate as two of the legacy app's
 * cardinal errors; if those steps carry the skips here, the same failure is
 * happening again in a district that has the screens for them.
 */
export function StepFunnelPanel({
  funnels,
}: {
  funnels: readonly DistrictStepFunnel[];
}) {
  if (funnels.length === 0) return null;

  return (
    <section aria-labelledby="funnel-heading">
      <h2
        id="funnel-heading"
        className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-700"
      >
        Where students stop
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {funnels.map((f) => (
          <div
            key={f.mode}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-bold text-gray-900">
                {MODES[f.mode].displayName}
              </h3>
              <span className="text-sm text-gray-600">
                {f.cohortSize.toLocaleString()} writings
              </span>
            </div>

            <dl className="mt-3 flex gap-6 border-b border-gray-200 pb-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Stalls at
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900">
                  {f.stall ? f.stall.label : "No drop-off"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Steps skipped
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900">
                  {pct(f.skipRate)}
                </dd>
              </div>
            </dl>

            <ol className="mt-3 space-y-2">
              {f.points.map((p) => {
                const share = rate(p.reached, f.cohortSize);
                const isStall = f.stall?.stepKey === p.stepKey;
                return (
                  <li key={p.stepKey} className="text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span
                        className={
                          isStall
                            ? "font-bold text-gray-900"
                            : "text-gray-700"
                        }
                      >
                        {p.label}
                        {isStall && (
                          <span className="ml-1.5 rounded bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-700">
                            largest drop
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums text-gray-600">
                        {pct(share)}
                      </span>
                    </div>
                    <div
                      aria-hidden="true"
                      className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100"
                    >
                      <div
                        className={`h-full rounded-full ${isStall ? "bg-rose-500" : "bg-gray-400"}`}
                        style={{ width: `${(share ?? 0) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
