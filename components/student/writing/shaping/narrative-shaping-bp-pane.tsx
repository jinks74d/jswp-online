"use client";

/**
 * Narrative shaping pane — the five-shape Shaping Sheet from the 2018
 * Personal & Fictional Narrative Guide, pp. 64/70.
 *
 * Layout (top to bottom):
 *   - Read-only WOW context (discovery + t-chart material to shape from)
 *   - TS  — inverted trapezoid  → shaping_sheets.final_topic_sentence
 *   - 1st CD — rectangle        → shaping_sheets.narrative_shaping_cd1
 *   - 2nd CD — rectangle        → shaping_sheets.narrative_shaping_cd2
 *   - CM  — ellipse             → shaping_sheets.narrative_shaping_cm
 *   - CS  — upright trapezoid   → shaping_sheets.final_concluding_sentence
 *   - Notes
 *
 * TS/CS reuse the existing final_* columns (no narrative_shaping_ts/_cs —
 * that would duplicate them, CLAUDE.md §14.3). CD1/CD2/CM are composed
 * sentences the student writes after studying their WOW notes; they get
 * their own columns (migration 0019) — they are NOT the raw narrative_*
 * T-Chart fields.
 *
 * JSWP color law: TS/CS → blue, CD → red, CM → green. Each shape carries
 * a bold side-label in its matching color; inputs overlay the shape with
 * a transparent background and the shape's text color.
 */

import { useEffect, useRef, useState } from "react";
import { AutoSaveInput } from "../t-chart/auto-save-input";
import { updateShapingSheet } from "@/lib/actions/shaping";
import { useWritingMode } from "../use-writing-mode";
import type { ShapingBpData } from "@/lib/queries/shaping";

export function NarrativeShapingBpPane({
  writingId,
  bp,
}: {
  writingId: string;
  bp: ShapingBpData;
}) {
  const { isReadOnly } = useWritingMode();
  const ss = bp.shaping_sheet;
  if (!ss) {
    return (
      <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
        Shaping sheet not yet bootstrapped for this body paragraph. Reload
        the page to retry.
      </div>
    );
  }

  const save = (updates: Parameters<typeof updateShapingSheet>[2]) =>
    updateShapingSheet(writingId, ss.id, updates);

  return (
    <div className="space-y-5 max-w-3xl">
      <WowContext bp={bp} />

      <div className="space-y-4">
        {bp.working_topic_sentence && (
          <ReadOnlyContext label="Working TS (from topic-sentences step)">
            {bp.working_topic_sentence}
          </ReadOnlyContext>
        )}
        <TrapezoidShape
          variant="ts"
          label="TS"
          placeholder="Drafted topic sentence…"
          initialValue={ss.final_topic_sentence ?? ""}
          disabled={isReadOnly}
          onSave={(v) => save({ final_topic_sentence: v })}
        />

        <RectShape
          label="1st CD"
          placeholder="First concrete detail sentence…"
          initialValue={ss.narrative_shaping_cd1 ?? ""}
          disabled={isReadOnly}
          onSave={(v) => save({ narrative_shaping_cd1: v })}
        />
        <RectShape
          label="2nd CD"
          placeholder="Second concrete detail sentence…"
          initialValue={ss.narrative_shaping_cd2 ?? ""}
          disabled={isReadOnly}
          onSave={(v) => save({ narrative_shaping_cd2: v })}
        />

        <EllipseShape
          label="CM"
          placeholder="Commentary sentence…"
          initialValue={ss.narrative_shaping_cm ?? ""}
          disabled={isReadOnly}
          onSave={(v) => save({ narrative_shaping_cm: v })}
        />

        {bp.concluding_sentence && (
          <ReadOnlyContext label="CS (from t-chart)">
            {bp.concluding_sentence}
          </ReadOnlyContext>
        )}
        <TrapezoidShape
          variant="cs"
          label="CS"
          placeholder="Drafted concluding sentence…"
          initialValue={ss.final_concluding_sentence ?? ""}
          disabled={isReadOnly}
          onSave={(v) => save({ final_concluding_sentence: v })}
        />
      </div>

      <Section title="Notes">
        <AutoSaveInput
          multiline
          rows={3}
          initialValue={ss.notes ?? ""}
          placeholder="Anything to remember about this paragraph's shaping…"
          disabled={isReadOnly}
          onSave={async (notes) => {
            await save({ notes });
          }}
        />
      </Section>
    </div>
  );
}

/* ─── Shape blocks (guide pp. 64/70) ──────────────────────────────── */

const BLUE = "#1d4ed8"; // text-blue-700
const GREEN = "#15803d"; // text-green-700
const DASH = { stroke: "#9ca3af", strokeWidth: 1, strokeDasharray: "8 5" };

const TRAPEZOID_POINTS = {
  ts: "0,0 700,0 590,118 110,118",
  cs: "110,0 590,0 700,118 0,118",
} as const;

const TRAPEZOID_LINES = {
  ts: [
    { x1: 14, y: 30, x2: 686 },
    { x1: 50, y: 62, x2: 650 },
    { x1: 88, y: 94, x2: 612 },
  ],
  cs: [
    { x1: 112, y: 30, x2: 588 },
    { x1: 56, y: 62, x2: 644 },
    { x1: 14, y: 94, x2: 686 },
  ],
} as const;

const ELLIPSE_LINES = [
  { x1: 20, y: 24, x2: 680 },
  { x1: 10, y: 52, x2: 690 },
  { x1: 20, y: 78, x2: 680 },
];

function TrapezoidShape({
  variant,
  label,
  initialValue,
  onSave,
  disabled,
  placeholder,
}: {
  variant: "ts" | "cs";
  label: string;
  initialValue: string;
  onSave: (value: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-16 shrink-0 text-sm font-bold text-blue-700">
        {label}
      </div>
      <div className="relative flex-1">
        <svg viewBox="0 0 700 118" className="block w-full">
          <polygon
            points={TRAPEZOID_POINTS[variant]}
            fill="white"
            stroke={BLUE}
            strokeWidth="2.5"
          />
          {TRAPEZOID_LINES[variant].map((ln, i) => (
            <line
              key={i}
              x1={ln.x1}
              y1={ln.y}
              x2={ln.x2}
              y2={ln.y}
              {...DASH}
            />
          ))}
        </svg>
        <ShapeField
          initialValue={initialValue}
          onSave={onSave}
          disabled={disabled}
          placeholder={placeholder}
          colorClass="text-blue-700"
          align="center"
          style={{ padding: "14px 96px", lineHeight: "26px" }}
        />
      </div>
    </div>
  );
}

function RectShape({
  label,
  initialValue,
  onSave,
  disabled,
  placeholder,
}: {
  label: string;
  initialValue: string;
  onSave: (value: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-16 shrink-0 text-sm font-bold text-red-600">
        {label}
      </div>
      <div
        className="relative flex-1 border-2 border-red-600"
        style={{ minHeight: 108 }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ padding: "10px 14px" }}
          aria-hidden="true"
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="border-b border-dashed border-gray-400"
              style={{ height: 22 }}
            />
          ))}
        </div>
        <ShapeField
          initialValue={initialValue}
          onSave={onSave}
          disabled={disabled}
          placeholder={placeholder}
          colorClass="text-red-600"
          style={{ padding: "10px 14px", lineHeight: "22px" }}
        />
      </div>
    </div>
  );
}

function EllipseShape({
  label,
  initialValue,
  onSave,
  disabled,
  placeholder,
}: {
  label: string;
  initialValue: string;
  onSave: (value: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-16 shrink-0 text-sm font-bold text-green-700">
        {label}
      </div>
      <div className="relative flex-1">
        <svg viewBox="0 0 700 100" className="block w-full">
          <ellipse
            cx="350"
            cy="50"
            rx="345"
            ry="47"
            fill="white"
            stroke={GREEN}
            strokeWidth="2.5"
          />
          {ELLIPSE_LINES.map((ln, i) => (
            <line key={i} x1={ln.x1} y1={ln.y} x2={ln.x2} y2={ln.y} {...DASH} />
          ))}
        </svg>
        <ShapeField
          initialValue={initialValue}
          onSave={onSave}
          disabled={disabled}
          placeholder={placeholder}
          colorClass="text-green-700"
          align="center"
          style={{ padding: "12px 64px", lineHeight: "26px" }}
        />
      </div>
    </div>
  );
}

/* ─── Autosave field overlaid on a shape ──────────────────────────── */
/**
 * Transparent, borderless textarea positioned over the shape SVG/box.
 * Blur-saves like <AutoSaveInput> but without the boxed chrome — the
 * shape itself is the visual frame, the dashed lines are its ruling.
 */
function ShapeField({
  initialValue,
  onSave,
  disabled,
  colorClass,
  placeholder,
  align = "left",
  style,
}: {
  initialValue: string;
  onSave: (value: string) => Promise<void>;
  disabled?: boolean;
  colorClass: string;
  placeholder?: string;
  align?: "left" | "center";
  style?: React.CSSProperties;
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
      console.error("narrative shaping save failed:", e);
      setStatus("error");
    }
  };

  return (
    <>
      <textarea
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onBlur={handleBlur}
        style={{ fontSize: 13, fontFamily: "inherit", textAlign: align, ...style }}
        className={`absolute inset-0 h-full w-full resize-none bg-transparent placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 disabled:opacity-60 ${colorClass}`}
      />
      <span
        className="absolute right-1 top-1 text-[10px] pointer-events-none"
        aria-live="polite"
      >
        {status === "saving" && <span className="text-gray-400">…</span>}
        {status === "saved" && <span className="text-green-600">✓</span>}
        {status === "error" && <span className="text-red-600">retry</span>}
      </span>
    </>
  );
}

/* ─── WOW read-only context ─────────────────────────────────────── */

function WowContext({ bp }: { bp: ShapingBpData }) {
  const items: Array<[string, string | null]> = [
    ["Key word", bp.narrative_key_word],
    ["Concrete example", bp.narrative_concrete_example],
    ["When", bp.narrative_when],
    ["Where", bp.narrative_where],
    ["Who", bp.narrative_who],
    ["What happened", bp.narrative_what_happened],
    ["Dialogue", bp.narrative_dialogue],
    ["Feeling", bp.narrative_feeling],
    ["Thinking", bp.narrative_thinking],
  ];

  const filled = items.filter(
    ([, v]) => v !== null && v !== undefined && v.trim().length > 0
  );

  if (filled.length === 0) {
    return (
      <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
        No discovery or WOW data yet — visit those steps first to anchor
        this paragraph.
      </div>
    );
  }

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-700 mb-2">
        From your discovery + WOW
      </div>
      <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[8rem_minmax(0,1fr)] text-sm">
        {filled.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-xs uppercase tracking-wide text-gray-500 sm:pt-0.5">
              {label}
            </dt>
            <dd className="text-gray-900 whitespace-pre-wrap line-clamp-3">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function Section({
  title,
  accentClass = "text-gray-700",
  children,
}: {
  title: string;
  accentClass?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <h3
        className={`text-sm font-semibold uppercase tracking-wide ${accentClass}`}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function ReadOnlyContext({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-amber-900 mb-0.5">
        {label}
      </div>
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{children}</p>
    </div>
  );
}
