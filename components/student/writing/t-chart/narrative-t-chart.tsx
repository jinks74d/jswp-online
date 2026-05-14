"use client";

/**
 * Narrative WOW T-Chart — a faithful two-column rebuild of the form on
 * pp. 63/69 of the 2018 Personal & Fictional Narrative Guide.
 *
 * Layout:
 *   - Header: BP# box (top-left) + centered title block
 *   - Topic Sentence — READ-ONLY, sourced from the topic-sentences step's
 *     working_topic_sentence (that step owns the TS; we only display it)
 *   - Two-column grid inside a heavy outer border:
 *       Left  "CDs" — When/Where/Who each paired with a "Details about …"
 *                     sub-block, then What Happened and Dialogue. Red text.
 *       Right "CMs" — upper thinking cloud, central "I was feeling…" oval,
 *                     lower thinking cloud. Green text.
 *
 * JSWP color law: TS → blue, CD inputs → red, CM inputs → green. No gray
 * field anywhere a CD or CM is collected.
 *
 * Field → column map (t_charts):
 *   When?/Details          → narrative_when / narrative_when_details
 *   Where?/Details         → narrative_where / narrative_where_details
 *   Who?/Details           → narrative_who / narrative_who_details
 *   What Happened          → narrative_what_happened
 *   Dialogue               → narrative_dialogue
 *   Upper cloud (thinking) → narrative_thinking
 *   Center oval (feeling)  → narrative_feeling
 *   Lower cloud (thinking) → narrative_thinking_2
 *
 * The "Prompt" line from the paper form is intentionally omitted — the
 * assignment prompt renders in the step chrome, not on the T-Chart.
 */

import { useEffect, useRef, useState } from "react";
import { Cloud as CloudIcon } from "lucide-react";
import { updateTChart } from "@/lib/actions/t-charts";
import { useWritingMode } from "../use-writing-mode";
import type { BodyParagraphData } from "@/lib/queries/t-charts";

export function NarrativeTChart({
  writingId,
  bp,
}: {
  writingId: string;
  bp: BodyParagraphData;
}) {
  const { isReadOnly } = useWritingMode();
  if (!bp.t_chart) {
    return (
      <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
        T-chart not yet bootstrapped for this body paragraph. Reload the
        page to retry.
      </div>
    );
  }
  const tc = bp.t_chart;
  const save = (updates: Parameters<typeof updateTChart>[2]) =>
    updateTChart(writingId, tc.id, updates);

  return (
    <div className="space-y-4">
      {/* ─── Header: BP# box + centered title ─────────────────────── */}
      <div className="flex items-stretch gap-3">
        <div className="shrink-0 flex flex-col items-center justify-center border-2 border-gray-900 px-3 py-1.5 leading-none">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-900">
            BP #
          </span>
          <span className="mt-0.5 text-xl font-bold text-gray-900">
            {bp.position}
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <span className="text-sm font-bold uppercase tracking-wide text-gray-900">
            Narrative (2+:1)
          </span>
          <span className="text-sm font-bold uppercase tracking-wide text-gray-900">
            Event, Person, Place, or Thing
          </span>
          <span className="text-sm font-bold uppercase tracking-wide text-gray-900">
            Gathering CDs and CMs on the T-Chart
          </span>
        </div>
      </div>

      <hr className="border-gray-900" />

      {/* ─── Topic Sentence (read-only, from topic-sentences step) ── */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-blue-700 mb-1">
          Topic Sentence
        </div>
        {tc.working_topic_sentence && tc.working_topic_sentence.trim() ? (
          <p className="text-sm text-blue-700 border-b border-dashed border-blue-300 pb-1 whitespace-pre-wrap">
            {tc.working_topic_sentence}
          </p>
        ) : (
          <p className="text-xs italic text-gray-500 border-b border-dashed border-gray-300 pb-1">
            Write this paragraph&apos;s topic sentence on the Topic
            Sentences step — it will appear here.
          </p>
        )}
      </div>

      <hr className="border-gray-900" />

      {/* ─── Two-column T-Chart ───────────────────────────────────── */}
      <div className="grid grid-cols-2 border-2 border-gray-900">
        {/* Left column — CDs */}
        <div>
          <div className="border-b-2 border-gray-900 py-1.5 text-center text-sm font-bold uppercase tracking-wide text-gray-900">
            CDs
          </div>
          <div className="space-y-3 p-3">
            <CdRow label="When?">
              <WowField
                color="cd"
                initialValue={tc.narrative_when ?? ""}
                disabled={isReadOnly}
                onSave={(v) => save({ narrative_when: v })}
              />
            </CdRow>
            <CdRow label="Details about When:" sub>
              <WowField
                color="cd"
                multiline
                rows={2}
                initialValue={tc.narrative_when_details ?? ""}
                disabled={isReadOnly}
                onSave={(v) => save({ narrative_when_details: v })}
              />
            </CdRow>

            <CdRow label="Where?">
              <WowField
                color="cd"
                initialValue={tc.narrative_where ?? ""}
                disabled={isReadOnly}
                onSave={(v) => save({ narrative_where: v })}
              />
            </CdRow>
            <CdRow label="Details about Where:" sub>
              <WowField
                color="cd"
                multiline
                rows={2}
                initialValue={tc.narrative_where_details ?? ""}
                disabled={isReadOnly}
                onSave={(v) => save({ narrative_where_details: v })}
              />
            </CdRow>

            <CdRow label="Who?">
              <WowField
                color="cd"
                initialValue={tc.narrative_who ?? ""}
                disabled={isReadOnly}
                onSave={(v) => save({ narrative_who: v })}
              />
            </CdRow>
            <CdRow label="Details about Who:" sub>
              <WowField
                color="cd"
                multiline
                rows={2}
                initialValue={tc.narrative_who_details ?? ""}
                disabled={isReadOnly}
                onSave={(v) => save({ narrative_who_details: v })}
              />
            </CdRow>

            <CdRow label="Details about What Happened (step-by-step)?">
              <WowField
                color="cd"
                multiline
                rows={5}
                initialValue={tc.narrative_what_happened ?? ""}
                disabled={isReadOnly}
                onSave={(v) => save({ narrative_what_happened: v })}
              />
            </CdRow>

            <CdRow label="Dialogue?">
              <WowField
                color="cd"
                multiline
                rows={3}
                placeholder={`"Where do you think you're going?" she asked.`}
                initialValue={tc.narrative_dialogue ?? ""}
                disabled={isReadOnly}
                onSave={(v) => save({ narrative_dialogue: v })}
              />
            </CdRow>
          </div>
        </div>

        {/* Right column — CMs */}
        <div className="border-l-2 border-gray-900">
          <div className="border-b-2 border-gray-900 py-1.5 text-center text-sm font-bold uppercase tracking-wide text-gray-900">
            CMs
          </div>
          <div className="p-3">
            <p className="mb-2 text-center text-xs text-gray-500">
              Fill in the circle in the middle, then web off into the
              clouds to dig deeper.
            </p>

            <Cloud prompt="What were you thinking? Why?">
              <WowField
                color="cm"
                multiline
                rows={2}
                initialValue={tc.narrative_thinking ?? ""}
                disabled={isReadOnly}
                onSave={(v) => save({ narrative_thinking: v })}
              />
            </Cloud>

            <Connector />

            <Oval>
              <WowField
                color="cm"
                multiline
                rows={3}
                placeholder="I was feeling … because …"
                initialValue={tc.narrative_feeling ?? ""}
                disabled={isReadOnly}
                onSave={(v) => save({ narrative_feeling: v })}
              />
            </Oval>

            <Connector />

            <Cloud prompt="What were you thinking? Why?">
              <WowField
                color="cm"
                multiline
                rows={2}
                initialValue={tc.narrative_thinking_2 ?? ""}
                disabled={isReadOnly}
                onSave={(v) => save({ narrative_thinking_2: v })}
              />
            </Cloud>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Layout helpers ──────────────────────────────────────────────── */

function CdRow({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className={
          sub
            ? "text-center text-xs font-bold text-gray-900"
            : "text-sm font-bold text-gray-900"
        }
      >
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/**
 * Modernized CMs-side elements. The printed guide (pp. 63/69) draws
 * literal cloud bubbles webbing off a center circle; here that becomes
 * soft green-tinted cards — the center "circle" reads as the elevated
 * white card, the "clouds" as the receding tinted cards around it.
 */
function Cloud({
  prompt,
  children,
}: {
  prompt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-green-200 bg-green-50/70 px-4 py-3">
      <div className="mb-2 flex items-center justify-center gap-1.5">
        <CloudIcon
          className="h-3.5 w-3.5 shrink-0 text-green-600"
          aria-hidden="true"
        />
        <p className="text-xs font-semibold text-green-800">{prompt}</p>
      </div>
      {children}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex justify-center py-1" aria-hidden="true">
      <div className="flex flex-col items-center gap-1">
        <span className="h-2.5 w-px bg-green-300" />
        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
        <span className="h-2.5 w-px bg-green-300" />
      </div>
    </div>
  );
}

function Oval({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-sm rounded-3xl border border-green-300 bg-white px-5 py-4 shadow-sm">
      <p className="mb-2 text-center text-xs font-semibold text-green-800">
        The circle in the middle
      </p>
      {children}
    </div>
  );
}

/* ─── Autosave field (dashed-underline, color-coded) ──────────────── */
/**
 * Inlined rather than using <AutoSaveInput> because that component
 * bakes in a boxed gray border; the guide's WOW cells are dashed
 * underline writing-lines. Same blur-save + revalidate-aware behavior.
 */
function WowField({
  color,
  initialValue,
  onSave,
  disabled,
  multiline,
  rows,
  placeholder,
}: {
  color: "cd" | "cm";
  initialValue: string;
  onSave: (value: string) => Promise<void>;
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) setValue(initialValue);
  }, [initialValue]);

  const handleBlur = async () => {
    isFocusedRef.current = false;
    if (value === initialValue) return;
    setStatus("saving");
    try {
      await onSave(value);
      setStatus("saved");
      setTimeout(
        () => setStatus((s) => (s === "saved" ? "idle" : s)),
        1200
      );
    } catch (e) {
      console.error("narrative t-chart save failed:", e);
      setStatus("error");
    }
  };

  const textColor = color === "cd" ? "text-red-600" : "text-green-700";
  const borderColor =
    color === "cd" ? "border-red-300" : "border-green-300";
  const cls = `w-full bg-transparent px-1 py-1 text-sm ${textColor} placeholder:text-gray-300 placeholder:not-italic border-b border-dashed ${borderColor} focus:outline-none focus:border-solid focus:border-blue-400 disabled:opacity-60`;

  return (
    <div className="relative">
      {multiline ? (
        <textarea
          value={value}
          rows={rows ?? 2}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={handleBlur}
          className={`${cls} resize-y leading-6`}
        />
      ) : (
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={handleBlur}
          className={cls}
        />
      )}
      <span
        className="absolute right-1 top-0.5 text-[10px] pointer-events-none"
        aria-live="polite"
      >
        {status === "saving" && <span className="text-gray-400">…</span>}
        {status === "saved" && <span className="text-green-600">✓</span>}
        {status === "error" && (
          <span className="text-red-600">retry</span>
        )}
      </span>
    </div>
  );
}
