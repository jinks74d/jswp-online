"use client";

/**
 * The "when you use it, you lose it" control for one piece of commentary on
 * the Expository T-Chart — three small buttons (TS / CM / CS) naming the
 * sentence the student spent it on.
 *
 * Single-valued, unlike the Shaping Sheet's independent toggles: picking CM
 * when TS is active moves the spend rather than adding one, and clicking the
 * active button releases it. That is the rule expressed in the widget —
 * a phrase cannot be spent twice.
 *
 * Marking a slot strikes it through and fades it (see CmCloud), so the
 * student can see at a glance what is left for the other two sentences.
 *
 * Accessibility: the buttons are a radio-style group. Each carries
 * aria-pressed plus a full-sentence title/aria-label, because "TS" alone is
 * not a usable name. Strike-through is paired with the visible "used in"
 * state, never colour alone (CLAUDE.md §9).
 */

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { STITCH_TARGETS, type StitchTarget } from "@/lib/pick-n-stitch";
import { useWritingMode } from "../use-writing-mode";

export function StitchControl({
  /** What the entry is, for the accessible name — e.g. "resolute and steadfast". */
  label,
  usedIn,
  onChange,
}: {
  label: string;
  usedIn: StitchTarget | null;
  onChange: (use: StitchTarget | null) => Promise<void>;
}) {
  const { isReadOnly } = useWritingMode();
  const [pending, start] = useTransition();

  if (isReadOnly) {
    // Teacher review: report the spend, don't offer to change it.
    if (!usedIn) return null;
    const target = STITCH_TARGETS.find((t) => t.key === usedIn);
    return (
      <p className="mt-1 text-center text-[10px] italic text-gray-500">
        Used in the {target?.long ?? usedIn}
      </p>
    );
  }

  return (
    <div
      role="group"
      aria-label={`Mark where you used “${label}”`}
      className="mt-1 flex items-center justify-center gap-1"
    >
      {STITCH_TARGETS.map((target) => {
        const active = usedIn === target.key;
        return (
          <button
            key={target.key}
            type="button"
            aria-pressed={active}
            aria-label={`Used in the ${target.long}`}
            title={`Used in the ${target.long}`}
            disabled={pending}
            onClick={() =>
              start(async () => {
                await onChange(active ? null : target.key);
              })
            }
            className={`inline-flex h-5 min-w-[26px] items-center justify-center rounded border px-1 text-[10px] font-semibold leading-none transition-colors disabled:opacity-50 ${
              active
                ? "border-emerald-800 bg-emerald-800 text-white"
                : "border-emerald-300 text-emerald-700 hover:border-emerald-600 hover:bg-emerald-100"
            }`}
          >
            {pending && active ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />
            ) : (
              target.short
            )}
          </button>
        );
      })}
    </div>
  );
}
