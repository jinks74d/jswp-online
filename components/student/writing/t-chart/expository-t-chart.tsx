"use client";

/**
 * Expository T-Chart — restyled to mirror the printed JSWP "T-Chart
 * Worksheet" (design base: T-Chart Worksheet.html). The artifact now reads
 * like the paper sheet students use: a white page on the app's gray canvas,
 * ruled writing lines, a centered T-CHART title, blue TOPIC / REVISED TOPIC /
 * COMMENTARY sentences, a red-CDs | green-CMs "T" with black rules, and the
 * commentary rendered as green "clouds" (ovals with rays).
 *
 *   ┌────────────── T-CHART · (2+:1) ──────────────┐
 *   │ ① THROWAWAY TOPIC SENTENCE  [blue ★, ruled]   │
 *   │ ④ REVISED TOPIC SENTENCE    [blue ★] (2+:1)   │
 *   ├──────────────────┬────────────────────────────┤
 *   │ ② CDs (red ▬)    │ ③ CMs (green ● clouds)     │  per-chunk grid
 *   ├──────────────────┴────────────────────────────┤
 *   │ ⑤ COMMENTARY (CM)           [green ●]         │
 *   │ ⑥ CONCLUDING SENTENCE (CS)  [blue ★!]         │
 *   └───────────────────────────────────────────────┘
 *
 * The circled numbers are real UI (OrderBadge), not just documentation:
 * the printed sheet stamps them on each region because the student does
 * not work top-to-bottom. The Revised TS, the COMMENTARY sentence and the
 * CS are all Pick-n-Stitched from commentary words the student has not
 * spent yet ("when you use it, you lose it"), so all three come after the
 * CD/CM work — hence 4, 5, 6 against a 1, 2, 3 visual order.
 *
 * Expository-only. argumentation + literary still render through
 * CdCmTChart / chunk-editor — untouched. The 3+:0 (summary) variant drops
 * the Revised TS row, the COMMENTARY row and the CM clouds (per-chunk
 * suppression lives in ExpositoryChunkGrid), leaving a 1-2-3 order.
 * Layout/spec config resolves from lib/expository-t-chart-spec.ts. All
 * editing stays on AutoSaveInput + server actions; the worksheet look is
 * presentation only.
 */

import { useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import { AutoSaveInput } from "./auto-save-input";
import { ExpositoryChunkGrid } from "./expository-chunk-grid";
import { OrderBadge } from "./order-badge";
import {
  RULED_FIELD,
  WORKSHEET_GLYPH,
  WORKSHEET_INK,
  chunkCountWord,
} from "./worksheet-style";
import { updateTChart, addChunk, removeChunk } from "@/lib/actions/t-charts";
import { useWritingMode } from "../use-writing-mode";
import { getExpositoryTChartSpec } from "@/lib/expository-t-chart-spec";
import {
  collectStitchPool,
  unusedEntries,
  type StitchEntry,
} from "@/lib/pick-n-stitch";
import type { BodyParagraphData } from "@/lib/queries/t-charts";
import type { TextAnnotationRow } from "@/lib/queries/text-annotations";
import type { Database } from "@/lib/database.types";

type Mode = Database["public"]["Enums"]["jswp_mode"];
type ChunkRatio = Database["public"]["Enums"]["jswp_chunk_ratio"];

export function ExpositoryTChart({
  writingId,
  bp,
  mode,
  writingChunkRatio,
  annotations,
}: {
  writingId: string;
  bp: BodyParagraphData;
  mode: Mode;
  writingChunkRatio: ChunkRatio;
  /** Read & Annotate commentary, surfaced in the CMs column. */
  annotations: readonly TextAnnotationRow[];
}) {
  const { isReadOnly } = useWritingMode();
  const spec = getExpositoryTChartSpec(writingChunkRatio);

  if (!bp.t_chart) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
        T-chart not yet bootstrapped for this body paragraph. Reload the
        page to retry.
      </div>
    );
  }
  const tc = bp.t_chart;
  // Total for the badges' "Work order: n of N" screenreader phrasing —
  // 6 regions at 2+:1 / 1:1, 3 at 3+:0.
  const orderTotal = Object.keys(spec.badges).length;
  // "When you use it, you lose it" — what the three Pick-n-Stitch rows still
  // have left to draw on. Recomputed from props on every render, so marking a
  // phrase spent in a cloud updates these lists immediately.
  const stitchable = unusedEntries(collectStitchPool(bp.chunks));

  return (
    <div className="bg-[#e9eaed] px-2 py-6 sm:px-6">
      {/* The "paper" sheet */}
      <div className="mx-auto max-w-[816px] rounded-sm bg-white px-6 py-8 shadow-[0_8px_30px_rgba(20,24,40,0.14),0_1px_2px_rgba(20,24,40,0.08)] sm:px-14 sm:py-10">
        {/* Title */}
        <header className="text-center">
          {/* h2 (not h3): this is the step's top heading under the page h1,
              so it must not skip a level (WCAG 1.3.1 heading order). */}
          <h2 className="text-2xl font-extrabold uppercase leading-tight tracking-tight text-gray-900">
            T-Chart
          </h2>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
            {chunkCountWord(bp.chunks.length)} · {spec.ratioLabel} · Step{" "}
            {spec.stepNumber}
          </p>
          {spec.showRevisedTs && (
            <p className="mx-auto mt-3 max-w-md text-[13px] leading-snug text-gray-600">
              The numbers show the order you work in — not top to bottom. Draft
              the throwaway topic sentence first, then the CDs and CMs, and come
              back up to revise.
            </p>
          )}
        </header>

        <div className="mt-7 space-y-5">
          {/* ① Throwaway Topic Sentence */}
          <SentenceRow
            label={spec.tsLabel}
            badge={spec.badges.ts}
            orderTotal={orderTotal}
            role="ts"
            initialValue={tc.working_topic_sentence ?? ""}
            placeholder="Write the topic sentence for this paragraph…"
            disabled={isReadOnly}
            onSave={async (working_topic_sentence) => {
              await updateTChart(writingId, tc.id, { working_topic_sentence });
            }}
          />

          {/* ④ Revised Topic Sentence — 2+:1 only */}
          {spec.showRevisedTs && (
            <SentenceRow
              label="Revised Topic Sentence (TS):"
              badge={spec.badges.revised_ts}
              orderTotal={orderTotal}
              role="ts"
              hint="“Pick-n-Stitch” unused commentary words and phrases to revise your topic sentence."
              stillUnused={stitchable}
              initialValue={tc.revised_topic_sentence ?? ""}
              placeholder="Revise your topic sentence using unused CM words…"
              disabled={isReadOnly}
              onSave={async (revised_topic_sentence) => {
                await updateTChart(writingId, tc.id, { revised_topic_sentence });
              }}
            />
          )}

          {/* ② CDs | ③ CMs — the two-column "T" */}
          <div className="space-y-4">
            {bp.chunks.map((chunk, i) => (
              <ExpositoryChunkGrid
                key={chunk.id}
                writingId={writingId}
                chunk={chunk}
                mode={mode}
                chunkNumber={i + 1}
                totalChunks={bp.chunks.length}
                showHeader={i === 0}
                cdBadge={spec.badges.cds}
                cmBadge={spec.badges.cms}
                orderTotal={orderTotal}
                annotations={annotations}
                onRemove={() => {
                  void removeChunk(writingId, chunk.id);
                }}
              />
            ))}
            {!isReadOnly && (
              <AddChunkButton
                writingId={writingId}
                bodyParagraphId={bp.id}
                mode={mode}
                ratio={writingChunkRatio}
              />
            )}
          </div>

          {/* ⑤ Commentary (CM) — the printed sheet's full-width COMMENTARY
              SENTENCE line. Suppressed at 3+:0 (a summary has no CMs to
              stitch from). */}
          {spec.showCmSentence && (
            <SentenceRow
              label="Commentary (CM):"
              badge={spec.badges.cm_sentence}
              orderTotal={orderTotal}
              role="cm"
              hint="“Pick-n-Stitch” unused commentary words and phrases to write your commentary sentence."
              stillUnused={stitchable}
              initialValue={tc.commentary_sentence ?? ""}
              placeholder="Write your commentary sentence…"
              disabled={isReadOnly}
              onSave={async (commentary_sentence) => {
                await updateTChart(writingId, tc.id, { commentary_sentence });
              }}
            />
          )}

          {/* ⑥ Concluding Sentence — the ★! row. No ellipsis anywhere in
              this row: the CS lands the paragraph, it doesn't trail off. */}
          <SentenceRow
            label={spec.csLabel}
            badge={spec.badges.cs}
            orderTotal={orderTotal}
            role="cs"
            hint={
              spec.showCmSentence
                ? "“Pick-n-Stitch” unused commentary words and phrases to write your concluding sentence."
                : undefined
            }
            stillUnused={spec.showCmSentence ? stitchable : undefined}
            initialValue={tc.concluding_sentence ?? ""}
            placeholder="Write the concluding sentence"
            disabled={isReadOnly}
            onSave={async (concluding_sentence) => {
              await updateTChart(writingId, tc.id, { concluding_sentence });
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Full-width ruled sentence row (TS / Revised TS / CM / CS) ───────
   Order badge, then the shape glyph, then the bold role label, then the
   writing on ruled paper lines. The glyph is the non-colour signal
   (CLAUDE.md §9): blue ★ for the topic sentence, green ● for commentary,
   blue ★! for the concluding sentence. Ink colour comes from the
   --jswp-color-* tokens, never a hard-coded hex (§14.10). */

type SentenceRole = "ts" | "cm" | "cs";

/**
 * Per-role glyph + ink. `textClass` is a full literal Tailwind class (not
 * built by interpolation) so the JIT compiler can see it; `ink` is the raw
 * hex the OrderBadge's inline border/text style needs.
 */
const ROLE_TOKEN: Record<
  SentenceRole,
  { glyph: string; textClass: string; ink: string }
> = {
  ts: {
    glyph: WORKSHEET_GLYPH.ts,
    textClass: "text-[color:var(--jswp-color-ts)]",
    ink: WORKSHEET_INK.ts,
  },
  cm: {
    glyph: WORKSHEET_GLYPH.cm,
    textClass: "text-[color:var(--jswp-color-cm)]",
    ink: WORKSHEET_INK.cm,
  },
  cs: {
    glyph: WORKSHEET_GLYPH.cs,
    textClass: "text-[color:var(--jswp-color-cs)]",
    ink: WORKSHEET_INK.ts,
  },
};

function SentenceRow({
  label,
  badge,
  orderTotal,
  role,
  hint,
  stillUnused,
  initialValue,
  placeholder,
  disabled,
  onSave,
}: {
  label: string;
  /** Completion-order number from the spec; undefined = no badge at this ratio. */
  badge?: number;
  orderTotal: number;
  role: SentenceRole;
  /** Pick-n-Stitch instruction shown under the label, where the guide has one. */
  hint?: string;
  /**
   * Commentary still available to stitch from. Passed only to the three
   * Pick-n-Stitch rows; undefined elsewhere (and at 3+:0, which has no CMs).
   */
  stillUnused?: readonly StitchEntry[];
  initialValue: string;
  placeholder: string;
  disabled: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const token = ROLE_TOKEN[role];
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        {badge !== undefined && (
          <OrderBadge n={badge} total={orderTotal} color={token.ink} />
        )}
        <span aria-hidden="true" className={token.textClass}>
          {token.glyph}
        </span>
        <span
          className={`text-sm font-semibold uppercase tracking-wide ${token.textClass}`}
        >
          {label}
        </span>
      </div>
      {hint && (
        <p className="mb-1.5 text-[13px] leading-snug text-gray-600">{hint}</p>
      )}
      {stillUnused && <StillUnused entries={stillUnused} />}
      <AutoSaveInput
        bare
        multiline
        rows={2}
        initialValue={initialValue}
        placeholder={placeholder}
        ariaLabel={label.replace(/:$/, "")}
        disabled={disabled}
        className={`${RULED_FIELD} ${token.textClass}`}
        onSave={onSave}
      />
    </div>
  );
}

/* ─── Still-unused commentary ─────────────────────────────────────────
   The other half of "when you use it, you lose it": having struck spent
   phrases out in the clouds, each Pick-n-Stitch row shows what is left,
   so the student doesn't scroll back up to find out. Read-only chips —
   the spending happens in the cloud, where the phrase lives. */

function StillUnused({ entries }: { entries: readonly StitchEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="mb-1.5 text-[12px] italic leading-snug text-amber-700">
        Every commentary word and phrase has been used. Add more to a cloud
        above if you need something to stitch from.
      </p>
    );
  }

  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-800">
        Still unused:
      </span>
      {entries.map((entry) => (
        <span
          key={`${entry.cmId}:${entry.slot ?? "oval"}`}
          className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[12px] leading-tight text-[color:var(--jswp-color-cm)]"
        >
          {entry.text}
        </span>
      ))}
    </div>
  );
}

/* ─── Add-chunk button ────────────────────────────────────────────── */

function AddChunkButton({
  writingId,
  bodyParagraphId,
  mode,
  ratio,
}: {
  writingId: string;
  bodyParagraphId: string;
  mode: Mode;
  ratio: ChunkRatio;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await addChunk(writingId, bodyParagraphId, mode, ratio);
        })
      }
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Plus className="h-4 w-4" aria-hidden="true" />
      )}
      Add chunk
    </button>
  );
}
