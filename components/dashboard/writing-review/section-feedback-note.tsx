"use client";

/**
 * One section's teacher feedback note (chunk per-section-feedback).
 *
 *  - Teacher (readOnly=false): a single textarea pre-filled with the
 *    existing note. Saves on blur via upsertSectionFeedback; clearing it
 *    and blurring deletes the note. Status indicator. One note per step.
 *    When gradeFormat !== 'none' a GradeInput sits beside the status span.
 *  - Student (readOnly=true): renders the note text read-only, or nothing
 *    when there is no note. Shown on the matching step page after return.
 */

import { useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { upsertSectionFeedback } from "@/lib/actions/teacher-feedback";
import { GradeInput } from "./grade-input";
import { setSectionGrade } from "@/lib/actions/feedback-grades";
import { formatGradeLabel, type GradeFormat } from "@/lib/grade-format";

export function SectionFeedbackNote({
  writingId,
  stepKey,
  initialBody,
  readOnly = false,
  gradeFormat,
  gradeValue,
}: {
  writingId: string;
  stepKey: string;
  initialBody: string;
  readOnly?: boolean;
  gradeFormat: GradeFormat;
  gradeValue: string;
}) {
  if (readOnly) {
    const text = initialBody.trim();
    const gradeLabel =
      gradeFormat !== "none" ? formatGradeLabel(gradeFormat, gradeValue) : "";
    if (text.length === 0 && gradeLabel.length === 0) return null;
    return (
      <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-800">
            <MessageSquare className="h-3.5 w-3.5" />
            Teacher feedback
          </span>
          {gradeLabel.length > 0 && (
            <GradeInput format={gradeFormat} value={gradeValue} readOnly />
          )}
        </div>
        {text.length > 0 && (
          <p className="whitespace-pre-wrap text-sm text-gray-900">{text}</p>
        )}
      </div>
    );
  }

  return (
    <TeacherNote
      writingId={writingId}
      stepKey={stepKey}
      initialBody={initialBody}
      gradeFormat={gradeFormat}
      gradeValue={gradeValue}
    />
  );
}

function TeacherNote({
  writingId,
  stepKey,
  initialBody,
  gradeFormat,
  gradeValue,
}: {
  writingId: string;
  stepKey: string;
  initialBody: string;
  gradeFormat: GradeFormat;
  gradeValue: string;
}) {
  const [value, setValue] = useState(initialBody);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const isFocusedRef = useRef(false);
  const lastSavedRef = useRef(initialBody);

  // Pick up server prop refresh when not actively editing.
  useEffect(() => {
    if (!isFocusedRef.current) {
      setValue(initialBody);
      lastSavedRef.current = initialBody;
    }
  }, [initialBody]);

  const handleBlur = async () => {
    isFocusedRef.current = false;
    if (value === lastSavedRef.current) return;
    setStatus("saving");
    try {
      await upsertSectionFeedback(writingId, stepKey, value);
      lastSavedRef.current = value;
      setStatus("saved");
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch (e) {
      console.error("section feedback save:", e);
      setStatus("error");
    }
  };

  return (
    <div className="mt-3 rounded-md border border-blue-200 bg-blue-50/60 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-800">
          <MessageSquare className="h-3.5 w-3.5" />
          Feedback on this section
        </span>
        <div className="flex items-center gap-2">
          {gradeFormat !== "none" && (
            <GradeInput
              format={gradeFormat}
              value={gradeValue}
              onSave={(v) => setSectionGrade(writingId, stepKey, v)}
            />
          )}
          <span className="text-xs text-gray-500" aria-live="polite">
            {status === "saving" && "Saving…"}
            {status === "saved" && <span className="text-green-600">Saved</span>}
            {status === "error" && <span className="text-red-600">Retry?</span>}
          </span>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onBlur={handleBlur}
        rows={2}
        placeholder="Leave feedback for this section (leave empty to remove)…"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}
