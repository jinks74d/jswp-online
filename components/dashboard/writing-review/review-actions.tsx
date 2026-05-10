"use client";

/**
 * Action bar for the teacher review surface. Two buttons:
 *
 *   - [Return for revision]: pre-flight gated. Disabled when 0
 *     unresolved feedback rows exist. Tooltip explains. Click →
 *     native confirm() → returnWriting(writingId). Status becomes
 *     'returned'.
 *
 *   - [Mark Graded]: click expands an inline composer with optional
 *     numeric score input (range 0-999.99 to match NUMERIC(5,2)).
 *     Confirm → gradeWriting(writingId, score|null). Status becomes
 *     'graded'. Phase 5 will swap this for rubric-based scoring.
 *
 * Idempotent on target state — see lib/actions/teacher-review.ts.
 *
 * Hidden on already-graded writings (graded is terminal in 4.7b's
 * UX; re-grade is Phase 5+ per spec).
 */

import { useState, useTransition } from "react";
import { Loader2, ArrowLeftCircle, Award } from "lucide-react";
import { returnWriting, gradeWriting } from "@/lib/actions/teacher-review";
import type { Database } from "@/lib/database.types";

type WritingStatus = Database["public"]["Enums"]["jswp_writing_status"];

interface Props {
  writingId: string;
  status: WritingStatus;
  unresolvedCount: number;
}

export function ReviewActions({ writingId, status, unresolvedCount }: Props) {
  const [grading, setGrading] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canReturn = unresolvedCount > 0 && status !== "graded";
  const showActions = status !== "graded";

  if (!showActions) {
    return null;
  }

  const onReturn = () => {
    if (!canReturn) return;
    if (
      !window.confirm(
        "Return this writing for revision? The student will be notified."
      )
    ) {
      return;
    }
    setError(null);
    start(async () => {
      try {
        await returnWriting(writingId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not return writing.");
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onReturn}
          disabled={!canReturn || pending}
          title={
            !canReturn
              ? "Add at least one feedback comment before returning."
              : undefined
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowLeftCircle className="w-4 h-4" />
          )}
          Return for revision
        </button>
        <button
          type="button"
          onClick={() => setGrading((v) => !v)}
          disabled={pending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white bg-green-700 hover:bg-green-800 disabled:opacity-50"
        >
          <Award className="w-4 h-4" />
          {grading ? "Cancel grading" : "Mark graded"}
        </button>
      </div>

      {grading && (
        <GradeComposer
          writingId={writingId}
          onClose={() => setGrading(false)}
          onError={setError}
        />
      )}

      {error && (
        <div className="text-sm text-red-700" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

function GradeComposer({
  writingId,
  onClose,
  onError,
}: {
  writingId: string;
  onClose: () => void;
  onError: (msg: string | null) => void;
}) {
  const [scoreText, setScoreText] = useState("");
  const [pending, start] = useTransition();

  const submit = () => {
    onError(null);
    const trimmed = scoreText.trim();
    let score: number | null = null;
    if (trimmed.length > 0) {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 999.99) {
        onError("Score must be a number between 0 and 999.99.");
        return;
      }
      score = Math.round(parsed * 100) / 100; // NUMERIC(5,2)
    }
    start(async () => {
      try {
        await gradeWriting(writingId, score);
        onClose();
      } catch (e) {
        onError(e instanceof Error ? e.message : "Could not grade writing.");
      }
    });
  };

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 space-y-2">
      <div className="text-xs text-gray-700">
        Optional score (0–999.99). Leave blank to mark graded without a number.
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          max="999.99"
          value={scoreText}
          onChange={(e) => setScoreText(e.target.value)}
          placeholder="e.g. 92"
          disabled={pending}
          className="w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-green-700 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white bg-green-700 hover:bg-green-800 disabled:opacity-50"
        >
          {pending && <Loader2 className="w-4 h-4 animate-spin" />}
          {pending ? "Grading…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
