"use client";

/**
 * Fictional Narrative ABC planning artifact — the Quick Fiction Planning
 * Page from the 2018 Personal & Fictional Narrative Guide, pp. 106-112.
 * Replaces the WOW T-Chart (narrative-t-chart.tsx) when the writing's
 * narrative_kind is 'fictional'. The step router (t-chart-client.tsx)
 * picks between them.
 *
 * Three parts on one page:
 *   A = Gather Ideas — nested-oval brainstorm. Center oval binds the key
 *       word/phrase of the prompt (narrative_key_word); the outer ring
 *       captures general ideas webbed off it (narrative_general_ideas).
 *   B = Breakdown    — bordered rectangle; the concrete example, an
 *       imaginary or actual event (narrative_concrete_example).
 *   C = The Plot     — a six-link story chain. The first link, "Key",
 *       reuses narrative_key_word (same value as A's center oval — the
 *       key term of the prompt); the other five links have their own
 *       columns: abc_character / abc_setting / abc_back_story /
 *       abc_conflict / abc_end (migration 0020).
 */

import { useEffect, useRef, useState } from "react";
import { updateTChart } from "@/lib/actions/t-charts";
import { useWritingMode } from "../use-writing-mode";
import type { BodyParagraphData } from "@/lib/queries/t-charts";

export function FictionalAbcPlan({
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
        Planning page not yet bootstrapped for this body paragraph. Reload
        the page to retry.
      </div>
    );
  }
  const tc = bp.t_chart;
  const save = (updates: Parameters<typeof updateTChart>[2]) =>
    updateTChart(writingId, tc.id, updates);

  return (
    <div className="space-y-7">
      <header className="text-center">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">
          Quick Fiction Planning Page
        </h2>
      </header>

      {/* A = Gather Ideas */}
      <Part
        letter="A"
        title="Gather Ideas"
        hint="In the center oval, write the key word or phrase of the prompt. Web off the word into the outer ring with general ideas that fit. Star the one you know best."
      >
        <NestedOvalBrainstorm
          keyWord={tc.narrative_key_word ?? ""}
          generalIdeas={tc.narrative_general_ideas ?? []}
          disabled={isReadOnly}
          onSaveKeyWord={(narrative_key_word) => save({ narrative_key_word })}
          onSaveIdeas={(narrative_general_ideas) =>
            save({ narrative_general_ideas })
          }
        />
      </Part>

      {/* B = Breakdown */}
      <Part
        letter="B"
        title="Breakdown"
        hint="Write the idea you selected and your concrete example — an imaginary or actual event. If it is a real event, create a character's name."
      >
        <div className="border-2 border-gray-900 p-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-900">
            B = Breakdown
          </div>
          <AutoText
            multiline
            rows={4}
            initialValue={tc.narrative_concrete_example ?? ""}
            placeholder="The story will be about…"
            disabled={isReadOnly}
            onSave={(narrative_concrete_example) =>
              save({ narrative_concrete_example })
            }
            className="w-full resize-y bg-transparent text-sm leading-6 text-gray-900 placeholder:text-gray-300 focus:outline-none"
          />
        </div>
      </Part>

      {/* C = The Plot (Chain) */}
      <Part
        letter="C"
        title="The Plot"
        hint="Use the story chain to develop the situation, link by link."
      >
        <Chain tc={tc} disabled={isReadOnly} save={save} />
      </Part>
    </div>
  );
}

/* ─── A — nested-oval brainstorm ──────────────────────────────────── */
/**
 * Two stacked SVG layers so the white-filled inner ellipse masks the
 * outer-ring textarea behind it: outer ellipse → ideas textarea →
 * inner ellipse → key-word input. Container holds the 600:210 ratio.
 */
function NestedOvalBrainstorm({
  keyWord,
  generalIdeas,
  disabled,
  onSaveKeyWord,
  onSaveIdeas,
}: {
  keyWord: string;
  generalIdeas: readonly string[];
  disabled?: boolean;
  onSaveKeyWord: (value: string) => Promise<void>;
  onSaveIdeas: (value: string[] | null) => Promise<void>;
}) {
  return (
    <div className="relative mx-auto aspect-[600/210] w-full max-w-[600px]">
      <svg
        viewBox="0 0 600 210"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <ellipse
          cx="300"
          cy="105"
          rx="292"
          ry="100"
          fill="white"
          stroke="#111827"
          strokeWidth="2.5"
        />
      </svg>

      {/* Outer ring — general ideas (sits in the top crescent) */}
      <div className="absolute inset-x-[7%] top-[5%] h-[30%]">
        <AutoText
          multiline
          initialValue={generalIdeas.join("\n")}
          placeholder="general ideas — one per line"
          disabled={disabled}
          onSave={async (raw) => {
            const arr = raw
              .split(/[,\n]/)
              .map((s) => s.trim())
              .filter(Boolean);
            await onSaveIdeas(arr.length > 0 ? arr : null);
          }}
          className="h-full w-full resize-none bg-transparent text-center text-xs leading-5 text-gray-700 placeholder:text-gray-300 focus:outline-none"
        />
      </div>

      <svg
        viewBox="0 0 600 210"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <ellipse
          cx="300"
          cy="105"
          rx="162"
          ry="60"
          fill="white"
          stroke="#111827"
          strokeWidth="2.5"
        />
      </svg>

      {/* Center oval — key word/phrase of the prompt */}
      <div className="absolute inset-x-[28%] top-[42%] flex h-[24%] items-center">
        <AutoText
          initialValue={keyWord}
          placeholder="key word"
          disabled={disabled}
          onSave={onSaveKeyWord}
          className="w-full bg-transparent text-center text-sm font-semibold text-blue-700 placeholder:text-blue-300 placeholder:font-normal focus:outline-none"
        />
      </div>
    </div>
  );
}

/* ─── C — the story chain ─────────────────────────────────────────── */

function Chain({
  tc,
  disabled,
  save,
}: {
  tc: NonNullable<BodyParagraphData["t_chart"]>;
  disabled: boolean;
  save: (updates: Parameters<typeof updateTChart>[2]) => Promise<void>;
}) {
  const links: ReadonlyArray<{
    label: string;
    value: string;
    onSave: (v: string) => Promise<void>;
  }> = [
    {
      label: "Key",
      value: tc.narrative_key_word ?? "",
      onSave: (v) => save({ narrative_key_word: v }),
    },
    {
      label: "Character",
      value: tc.abc_character ?? "",
      onSave: (v) => save({ abc_character: v }),
    },
    {
      label: "Setting",
      value: tc.abc_setting ?? "",
      onSave: (v) => save({ abc_setting: v }),
    },
    {
      label: "Back Story",
      value: tc.abc_back_story ?? "",
      onSave: (v) => save({ abc_back_story: v }),
    },
    {
      label: "Conflict",
      value: tc.abc_conflict ?? "",
      onSave: (v) => save({ abc_conflict: v }),
    },
    {
      label: "End",
      value: tc.abc_end ?? "",
      onSave: (v) => save({ abc_end: v }),
    },
  ];

  return (
    <div className="flex flex-col items-center">
      {links.map((link, i) => (
        <div key={link.label} className="flex flex-col items-center">
          <ChainCircle
            label={link.label}
            initialValue={link.value}
            disabled={disabled}
            onSave={link.onSave}
          />
          {i < links.length - 1 && <ChainConnector />}
        </div>
      ))}
    </div>
  );
}

function ChainCircle({
  label,
  initialValue,
  onSave,
  disabled,
}: {
  label: string;
  initialValue: string;
  onSave: (value: string) => Promise<void>;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="mb-1 text-sm font-bold text-gray-900">{label}</div>
      <div className="relative h-[120px] w-[120px]">
        <svg
          viewBox="0 0 120 120"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <circle
            cx="60"
            cy="60"
            r="55"
            fill="white"
            stroke="#111827"
            strokeWidth="2"
          />
        </svg>
        <div className="absolute inset-[18%]">
          <AutoText
            multiline
            initialValue={initialValue}
            disabled={disabled}
            onSave={onSave}
            className="h-full w-full resize-none bg-transparent text-center text-gray-900 placeholder:text-gray-300 focus:outline-none"
            style={{ fontSize: 12, lineHeight: "16px" }}
          />
        </div>
      </div>
    </div>
  );
}

function ChainConnector() {
  return (
    <svg
      width="20"
      height="28"
      viewBox="0 0 20 28"
      className="my-0.5 block"
      aria-hidden="true"
    >
      <ellipse
        cx="10"
        cy="14"
        rx="8"
        ry="12"
        fill="white"
        stroke="#111827"
        strokeWidth="2"
      />
    </svg>
  );
}

/* ─── Part wrapper ────────────────────────────────────────────────── */

function Part({
  letter,
  title,
  hint,
  children,
}: {
  letter: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
          {letter}
        </span>
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">
          {title}
        </h3>
      </div>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      <div className="pt-1">{children}</div>
    </section>
  );
}

/* ─── Autosave field (transparent; the shape is the visual frame) ─── */

function AutoText({
  initialValue,
  onSave,
  disabled,
  multiline,
  rows,
  placeholder,
  className,
  style,
}: {
  initialValue: string;
  onSave: (value: string) => Promise<void>;
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
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
      console.error("fictional ABC plan save failed:", e);
      setStatus("error");
    }
  };

  return (
    <div className="relative h-full w-full">
      {multiline ? (
        <textarea
          value={value}
          rows={rows}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={handleBlur}
          style={style}
          className={className}
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
          style={style}
          className={className}
        />
      )}
      {status !== "idle" && (
        <span
          className="absolute -right-1 -top-1 text-[9px] pointer-events-none"
          aria-live="polite"
        >
          {status === "saving" && <span className="text-gray-400">…</span>}
          {status === "saved" && <span className="text-green-600">✓</span>}
          {status === "error" && <span className="text-red-600">!</span>}
        </span>
      )}
    </div>
  );
}
