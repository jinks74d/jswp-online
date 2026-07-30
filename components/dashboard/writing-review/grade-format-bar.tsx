"use client";

/**
 * Per-writing grade-format selector (migration 0031). Sets
 * student_writings.grade_format; all section + overall grade inputs follow.
 */

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { setGradeFormat } from "@/lib/actions/feedback-grades";
import type { GradeFormat } from "@/lib/grade-format";

const OPTIONS: { value: GradeFormat; label: string }[] = [
  { value: "none", label: "Off" },
  { value: "number", label: "Number" },
  { value: "letter", label: "Letter" },
  { value: "check", label: "✓ / ✗" },
];

export function GradeFormatBar({
  writingId,
  format,
}: {
  writingId: string;
  format: GradeFormat;
}) {
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);

  const choose = (f: GradeFormat) => {
    if (f === format) return;
    setFailed(false);
    start(async () => {
      try {
        await setGradeFormat(writingId, f);
      } catch (e) {
        console.error("set grade format:", e);
        setFailed(true);
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <span className="text-sm font-medium text-stone-700">Grade format</span>
      <div className="inline-flex overflow-hidden rounded-md border border-stone-200">
        {OPTIONS.map((o) => {
          const active = o.value === format;
          return (
            <button
              key={o.value}
              type="button"
              disabled={pending}
              aria-pressed={active}
              onClick={() => choose(o.value)}
              className={`px-3 py-1 text-sm font-medium ${
                active
                  ? "bg-slate-800 text-white"
                  : "bg-white text-stone-700 hover:bg-stone-50"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {pending && (
        <Loader2
          className="h-4 w-4 animate-spin text-stone-400"
          aria-hidden="true"
        />
      )}
      {!pending && failed && (
        <span role="alert" className="text-sm font-semibold text-red-600">
          ⚠ Not saved — try again
        </span>
      )}
      <span className="text-xs text-stone-500">
        Applies to every section grade and the overall grade.
      </span>
    </div>
  );
}
