"use client";

/**
 * T-chart step orchestrator. Lays out:
 *
 *   Desktop: [tabs (BP1, BP2, ...)]   [reference panel]
 *            [active BP form]           [...]
 *
 *   Mobile:  reference panel collapses to <details> at the top, tabs
 *            scroll horizontally, form below.
 *
 * Picks CdCmTChart vs NarrativeTChart based on writing.mode and
 * computes the per-BP Continue gate from the current data prop. Data
 * stays in props (not local state) so revalidatePath after each
 * mutation flows fresh state down without manual sync.
 */

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { CdCmTChart } from "./cd-cm-t-chart";
import { ExpositoryTChart } from "./expository-t-chart";
import { NarrativeTChart } from "./narrative-t-chart";
import { FictionalAbcPlan } from "./fictional-abc-plan";
import { ReferencePanel } from "../reference-panel";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import { narrativeBpLabel } from "@/lib/narrative-bp-labels";
import { useWritingMode } from "../use-writing-mode";
import type { BodyParagraphData } from "@/lib/queries/t-charts";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";
import type { Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];
type ChunkRatio = Database["public"]["Enums"]["jswp_chunk_ratio"];

interface Props {
  writingId: string;
  stepKey: string;
  mode: Mode;
  writingChunkRatio: ChunkRatio;
  bodyParagraphs: readonly BodyParagraphData[];
  // Reference panel data (only present when assignment has source text)
  sourceText: string | null;
  sourceTitle: string | null;
  sourceAuthor: string | null;
  annotations: readonly TextAnnotationRow[];
}

type BlockerKind = "fictional" | "wow" | "cdcm";

interface GateResult {
  canContinue: boolean;
  blockerPosition: number | null;
  blockerKind: BlockerKind | null;
}

function computeGate(
  mode: Mode,
  bps: readonly BodyParagraphData[]
): GateResult {
  const isNarrative = mode === "narrative";
  for (const bp of bps) {
    const tc = bp.t_chart;
    // Fictional narratives use the ABC plan, not the WOW fields — gate on
    // ABC content (key word / concrete example / story conflict) instead.
    if (isNarrative && tc?.narrative_kind === "fictional") {
      const hasContent = !!(
        (tc?.narrative_key_word && tc.narrative_key_word.trim()) ||
        (tc?.narrative_concrete_example &&
          tc.narrative_concrete_example.trim()) ||
        (tc?.abc_conflict && tc.abc_conflict.trim())
      );
      if (!hasContent) {
        return {
          canContinue: false,
          blockerPosition: bp.position,
          blockerKind: "fictional",
        };
      }
    } else if (isNarrative) {
      const hasContent = !!(
        (tc?.narrative_when && tc.narrative_when.trim()) ||
        (tc?.narrative_where && tc.narrative_where.trim()) ||
        (tc?.narrative_who && tc.narrative_who.trim()) ||
        (tc?.narrative_what_happened && tc.narrative_what_happened.trim())
      );
      if (!hasContent) {
        return {
          canContinue: false,
          blockerPosition: bp.position,
          blockerKind: "wow",
        };
      }
    } else {
      const hasCD = bp.chunks.some((c) =>
        c.concrete_details.some((cd) => cd.text.trim().length > 0)
      );
      if (!hasCD) {
        return {
          canContinue: false,
          blockerPosition: bp.position,
          blockerKind: "cdcm",
        };
      }
    }
  }
  return { canContinue: true, blockerPosition: null, blockerKind: null };
}

export function TChartClient({
  writingId,
  stepKey,
  mode,
  writingChunkRatio,
  bodyParagraphs,
  sourceText,
  sourceTitle,
  sourceAuthor,
  annotations,
}: Props) {
  const { isReadOnly } = useWritingMode();
  const [activeIdx, setActiveIdx] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const gate = computeGate(mode, bodyParagraphs);
  const activeBp = bodyParagraphs[activeIdx] ?? bodyParagraphs[0];
  const isNarrative = mode === "narrative";
  const showReference = sourceText !== null;

  const onContinue = () => {
    setError(null);
    start(async () => {
      try {
        await completeStepAndAdvance(writingId, stepKey);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NEXT_REDIRECT") return;
        setError(msg || "Could not continue.");
      }
    });
  };

  const formColumn = (
    <div className="space-y-4 min-w-0">
      {bodyParagraphs.length > 1 && (
        <div
          role="tablist"
          aria-label="Body paragraphs"
          className="flex gap-1 border-b border-gray-200 overflow-x-auto"
        >
          {bodyParagraphs.map((bp, i) => {
            const active = i === activeIdx;
            return (
              <button
                key={bp.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveIdx(i)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                  active
                    ? "text-gray-900"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
                style={
                  active
                    ? { borderBottomColor: "var(--district-primary)" }
                    : undefined
                }
              >
                {narrativeBpLabel(
                  bp.t_chart?.narrative_kind ?? null,
                  bp.t_chart?.narrative_subject ?? null,
                  bp.position,
                  bodyParagraphs.length
                )}
              </button>
            );
          })}
        </div>
      )}

      {activeBp ? (
        isNarrative ? (
          activeBp.t_chart?.narrative_kind === "fictional" ? (
            <FictionalAbcPlan writingId={writingId} bp={activeBp} />
          ) : (
            <NarrativeTChart writingId={writingId} bp={activeBp} />
          )
        ) : mode === "expository" ? (
          <ExpositoryTChart
            writingId={writingId}
            bp={activeBp}
            mode={mode}
            writingChunkRatio={writingChunkRatio}
          />
        ) : (
          <CdCmTChart
            writingId={writingId}
            bp={activeBp}
            mode={mode}
            writingChunkRatio={writingChunkRatio}
          />
        )
      ) : (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
          No body paragraphs yet. Reload to bootstrap.
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {showReference && sourceText && (
        <details className="lg:hidden bg-white border border-gray-200 rounded-lg group">
          <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">
              Source text & annotations
            </span>
            <span className="text-xs text-gray-500 group-open:hidden">Show</span>
            <span className="text-xs text-gray-500 hidden group-open:inline">
              Hide
            </span>
          </summary>
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <ReferencePanel
              sourceText={sourceText}
              sourceTitle={sourceTitle}
              sourceAuthor={sourceAuthor}
              annotations={annotations}
            />
          </div>
        </details>
      )}

      <div
        className={`grid gap-6 ${
          showReference
            ? "lg:grid-cols-[minmax(0,1fr)_22rem]"
            : "grid-cols-1"
        }`}
      >
        {formColumn}

        {showReference && sourceText && (
          <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
            <ReferencePanel
              sourceText={sourceText}
              sourceTitle={sourceTitle}
              sourceAuthor={sourceAuthor}
              annotations={annotations}
            />
          </aside>
        )}
      </div>

      {!isReadOnly && (
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            {gate.canContinue
              ? `${bodyParagraphs.length} body paragraph${
                  bodyParagraphs.length === 1 ? "" : "s"
                } ready`
              : gate.blockerKind === "fictional"
                ? `Body paragraph ${gate.blockerPosition} needs ABC planning — a key word, concrete example, or story conflict.`
                : gate.blockerKind === "wow"
                  ? `Body paragraph ${gate.blockerPosition} needs at least one WOW detail (when, where, who, or what happened).`
                  : `Body paragraph ${gate.blockerPosition} needs at least one concrete detail.`}
          </div>
          <div className="flex items-center gap-3">
            {error && (
              <div className="text-sm text-red-700" role="alert">
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={onContinue}
              disabled={!gate.canContinue || pending}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--district-primary)" }}
            >
              {pending && <Loader2 className="w-4 h-4 animate-spin" />}
              {pending ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
