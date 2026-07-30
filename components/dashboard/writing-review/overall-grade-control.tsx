"use client";

import { GradeInput } from "./grade-input";
import { setOverallGrade } from "@/lib/actions/feedback-grades";
import type { GradeFormat } from "@/lib/grade-format";

export function OverallGradeControl({
  writingId,
  format,
  value,
}: {
  writingId: string;
  format: GradeFormat;
  value: string;
}) {
  if (format === "none") return null;
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-sm font-medium text-stone-700">Overall grade</span>
      <GradeInput
        format={format}
        value={value}
        onSave={(v) => setOverallGrade(writingId, v)}
        ariaLabel="Overall grade"
      />
    </div>
  );
}
