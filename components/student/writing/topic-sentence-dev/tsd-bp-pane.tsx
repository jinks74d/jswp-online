"use client";

/**
 * One body paragraph's TSD pane: tally header + selected-candidate
 * list, each row with a 3-way side picker.
 *
 * Visual rules:
 *   pro     → emerald-100/700 (intentionally NOT JSWP green-* which
 *              is reserved for CMs)
 *   con     → rose-100/700    (intentionally NOT JSWP red-* which
 *              is reserved for CDs)
 *   neutral → gray-100/600
 *
 * Tally counts only is_selected=true candidates' tags. Direction
 * nudge appears only when one side strictly dominates — pro==con
 * or all-neutral suppresses to avoid sending a false signal.
 */

import Link from "next/link";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { setCandidateSide } from "@/lib/actions/candidate-cds";
import type {
  CandidateData,
  GatheringSheetData,
} from "@/lib/queries/candidate-cds";

type Side = "pro" | "con" | "neutral";

const SIDE_OPTIONS: ReadonlyArray<{
  value: Side;
  label: string;
  selectedClass: string;
  unselectedClass: string;
}> = [
  {
    value: "pro",
    label: "For",
    selectedClass: "bg-emerald-100 text-emerald-700 border-emerald-300",
    unselectedClass:
      "text-gray-600 hover:text-emerald-700 hover:bg-emerald-50",
  },
  {
    value: "neutral",
    label: "Neutral",
    selectedClass: "bg-gray-100 text-gray-700 border-gray-300",
    unselectedClass: "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
  },
  {
    value: "con",
    label: "Against",
    selectedClass: "bg-rose-100 text-rose-700 border-rose-300",
    unselectedClass: "text-gray-600 hover:text-rose-700 hover:bg-rose-50",
  },
];

export function TsdBpPane({
  writingId,
  sheet,
}: {
  writingId: string;
  sheet: GatheringSheetData;
}) {
  const selected = sheet.candidates.filter((c) => c.is_selected);

  if (selected.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-md p-5 text-center">
        <p className="text-sm text-amber-900">
          No selected candidates yet for body paragraph{" "}
          {sheet.body_paragraph_position}.
        </p>
        <p className="mt-1 text-xs text-amber-800">
          Go back to gather-cds and check the candidates you want to use —
          you&apos;ll tag them as For/Against/Neutral here.
        </p>
        <Link
          href={`/student/writings/${writingId}/gather-cds`}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-300 bg-white text-sm text-amber-900 hover:bg-amber-50"
        >
          Back to Gather CDs
        </Link>
      </div>
    );
  }

  const tally = computeTally(selected);
  const direction = directionNudge(tally);

  return (
    <div className="space-y-4">
      <header className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
          Tally
        </div>
        <div className="flex items-baseline gap-3 text-sm">
          <span className="text-emerald-700">
            <span className="font-semibold">Pro:</span> {tally.pro}
          </span>
          <span className="text-gray-400">·</span>
          <span className="text-rose-700">
            <span className="font-semibold">Con:</span> {tally.con}
          </span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-700">
            <span className="font-semibold">Neutral:</span> {tally.neutral}
          </span>
        </div>
        {direction && (
          <p className="mt-1.5 text-xs text-gray-600">
            Your direction is likely{" "}
            <span className="font-semibold text-gray-900">{direction}</span>.
          </p>
        )}
      </header>

      <ul className="space-y-2">
        {selected.map((c) => (
          <CandidateRow
            key={c.id}
            writingId={writingId}
            candidate={c}
          />
        ))}
      </ul>
    </div>
  );
}

function CandidateRow({
  writingId,
  candidate,
}: {
  writingId: string;
  candidate: CandidateData;
}) {
  const [pending, start] = useTransition();

  const onSelect = (side: Side) => {
    // Click the same value to toggle off → null.
    const next = candidate.argumentation_side === side ? null : side;
    start(async () => {
      await setCandidateSide(writingId, candidate.id, next);
    });
  };

  return (
    <li className="bg-white border border-gray-200 rounded-md p-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        {candidate.selection_order !== null && (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-semibold mr-2 align-text-bottom">
            {candidate.selection_order}
          </span>
        )}
        <span className="text-sm text-gray-900 whitespace-pre-wrap">
          {candidate.text || (
            <span className="italic text-gray-400">
              (empty candidate — fill it in on gather-cds)
            </span>
          )}
        </span>
      </div>
      <div
        role="radiogroup"
        aria-label={`Side for ${candidate.text || "this candidate"}`}
        className="inline-flex rounded-md border border-gray-300 overflow-hidden divide-x divide-gray-200 shrink-0"
      >
        {SIDE_OPTIONS.map((opt) => {
          const active = candidate.argumentation_side === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(opt.value)}
              disabled={pending}
              className={`px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                active ? opt.selectedClass : opt.unselectedClass
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {pending && (
        <Loader2 className="w-4 h-4 animate-spin text-gray-400 mt-1" />
      )}
    </li>
  );
}

/* ─── Tally + direction helpers ──────────────────────────────────── */

interface Tally {
  pro: number;
  con: number;
  neutral: number;
}

function computeTally(selectedCandidates: readonly CandidateData[]): Tally {
  const t: Tally = { pro: 0, con: 0, neutral: 0 };
  for (const c of selectedCandidates) {
    if (c.argumentation_side === "pro") t.pro++;
    else if (c.argumentation_side === "con") t.con++;
    else if (c.argumentation_side === "neutral") t.neutral++;
  }
  return t;
}

/**
 * Returns "for" / "against" / null per the chunk 4.5a contract:
 *   pro > con  → "for"
 *   con > pro  → "against"
 *   pro === con (including all-neutral or untagged) → null
 */
function directionNudge(tally: Tally): "for" | "against" | null {
  if (tally.pro > tally.con) return "for";
  if (tally.con > tally.pro) return "against";
  return null;
}
