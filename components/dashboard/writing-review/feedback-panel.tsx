"use client";

/**
 * Sticky right-rail feedback panel. Two render modes:
 *   - 'teacher': composer + list with edit/delete on own
 *   - 'student': list with [Mark resolved] only, no composer
 *
 * Lists feedback newest-first. Resolved items collapse under a
 * "Show N resolved" toggle.
 *
 * Composer:
 *   - Always-visible textarea (no expand-on-click).
 *   - [Add comment] button.
 *   - Cmd/Ctrl+Enter submits.
 *   - On success: clears textarea; revalidatePath fires server-side
 *     so the panel re-renders with the new row.
 */

import { useState, useTransition } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { addWritingFeedback } from "@/lib/actions/teacher-feedback";
import { FeedbackItem } from "./feedback-item";
import type { FeedbackItemRow } from "@/lib/queries/teacher-feedback";

interface Props {
  writingId: string;
  feedback: readonly FeedbackItemRow[];
  mode: "teacher" | "student";
  currentUserId: string;
}

export function FeedbackPanel({
  writingId,
  feedback,
  mode,
  currentUserId,
}: Props) {
  const unresolved = feedback.filter((f) => !f.is_resolved);
  const resolved = feedback.filter((f) => f.is_resolved);
  const [showResolved, setShowResolved] = useState(false);

  return (
    <aside className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-gray-700" />
        <h2 className="text-sm font-semibold text-gray-900">Feedback</h2>
        <span className="text-xs text-gray-500">
          ({unresolved.length} open
          {resolved.length > 0 && ` · ${resolved.length} resolved`})
        </span>
      </div>

      {mode === "teacher" && (
        <Composer writingId={writingId} />
      )}

      {feedback.length === 0 ? (
        <p className="text-xs text-gray-500 italic">
          {mode === "teacher"
            ? "No comments yet. Add one above."
            : "No feedback yet."}
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {unresolved.map((f) => (
              <FeedbackItem
                key={f.id}
                feedback={f}
                mode={mode}
                currentUserId={currentUserId}
              />
            ))}
            {unresolved.length === 0 && (
              <p className="text-xs text-gray-500 italic">
                No open comments.
              </p>
            )}
          </div>

          {resolved.length > 0 && (
            <div className="pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowResolved((v) => !v)}
                className="text-xs text-gray-600 hover:text-gray-900"
              >
                {showResolved ? "Hide" : "Show"} {resolved.length}{" "}
                resolved
              </button>
              {showResolved && (
                <div className="mt-2 space-y-2">
                  {resolved.map((f) => (
                    <FeedbackItem
                      key={f.id}
                      feedback={f}
                      mode={mode}
                      currentUserId={currentUserId}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  );
}

function Composer({ writingId }: { writingId: string }) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const trimmed = body.trim();
    if (trimmed.length === 0) {
      setError("Comment cannot be empty.");
      return;
    }
    start(async () => {
      try {
        await addWritingFeedback(writingId, trimmed);
        setBody("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add comment.");
      }
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
        placeholder="Write feedback for this student…"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-gray-500">
          ⌘/Ctrl + Enter to submit
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={pending || body.trim().length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          {pending ? "Adding…" : "Add comment"}
        </button>
      </div>
      {error && (
        <div className="text-xs text-red-700" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
