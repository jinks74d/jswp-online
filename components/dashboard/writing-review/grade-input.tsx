"use client";

/**
 * Format-aware grade control for the feedback area (migration 0031).
 *  - format='none'  → renders nothing.
 *  - readOnly       → a small badge (formatGradeLabel), nothing when empty.
 *  - number         → a 0–100 input, saves on blur.
 *  - letter         → a <select> of LETTER_GRADES (+ "—" to clear).
 *  - check          → ✓ / ✗ toggle buttons (click active to clear).
 */

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  LETTER_GRADES,
  formatGradeLabel,
  type GradeFormat,
} from "@/lib/grade-format";

export function GradeInput({
  format,
  value,
  onSave,
  readOnly = false,
  ariaLabel,
}: {
  format: GradeFormat;
  value: string;
  onSave?: (value: string) => Promise<void>;
  readOnly?: boolean;
  ariaLabel?: string;
}) {
  const [pending, start] = useTransition();
  const [local, setLocal] = useState(value);
  const [failed, setFailed] = useState(false);

  // Re-sync the number field when the server value changes (after a save +
  // revalidate, or a format switch). Letter/check read `value` directly, so
  // this only affects the number variant.
  useEffect(() => {
    setLocal(value);
  }, [value]);

  if (format === "none") return null;

  if (readOnly) {
    const text = formatGradeLabel(format, value);
    if (!text) return null;
    return (
      <span className="inline-flex items-center rounded-md border border-stone-300 bg-stone-50 px-2 py-0.5 text-sm font-semibold text-stone-800">
        {text}
      </span>
    );
  }

  const save = (next: string) => {
    if (!onSave) return;
    setFailed(false);
    start(async () => {
      try {
        await onSave(next);
      } catch (e) {
        console.error("grade save:", e);
        setFailed(true);
      }
    });
  };

  // Inline indicator: spinner while saving, red "not saved" mark on failure.
  const statusMark = pending ? (
    <Loader2
      className="h-3.5 w-3.5 animate-spin text-stone-400"
      aria-hidden="true"
    />
  ) : failed ? (
    <span
      role="alert"
      title="Couldn’t save — try again"
      className="text-sm font-bold text-red-600"
    >
      ⚠ Not saved
    </span>
  ) : null;

  if (format === "check") {
    return (
      <span className="inline-flex items-center gap-1">
        {(["check", "x"] as const).map((tok) => {
          const active = value === tok;
          return (
            <button
              key={tok}
              type="button"
              disabled={pending}
              aria-pressed={active}
              aria-label={tok === "check" ? "Check (pass)" : "Cross (fail)"}
              onClick={() => save(active ? "" : tok)}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm font-bold ${
                active
                  ? "border-stone-400 bg-stone-100 text-stone-900"
                  : "border-stone-200 text-stone-400 hover:bg-stone-50"
              }`}
            >
              <span aria-hidden="true">{tok === "check" ? "✓" : "✗"}</span>
            </button>
          );
        })}
        {statusMark}
      </span>
    );
  }

  if (format === "letter") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <select
          value={value}
          disabled={pending}
          onChange={(e) => save(e.target.value)}
          className="rounded-md border border-stone-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label={ariaLabel ?? "Grade"}
        >
          <option value="">—</option>
          {LETTER_GRADES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        {statusMark}
      </span>
    );
  }

  // number
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        max={100}
        inputMode="numeric"
        value={local}
        disabled={pending}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local.trim() !== value.trim()) save(local.trim());
        }}
        placeholder="0–100"
        aria-label={ariaLabel ?? "Grade"}
        className="w-20 rounded-md border border-stone-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {statusMark}
    </span>
  );
}
