"use client";

/**
 * Single feedback row in the panel. Three responsibilities:
 *   - Display the body, author name, and "X minutes ago" timestamp.
 *   - In teacher mode, expose [Edit] / [Delete] when the row's
 *     teacher_id === currentUserId (RLS would reject otherwise; the
 *     UI hides the affordances pre-emptively).
 *   - In student mode, expose [Mark resolved] when is_resolved=false.
 *
 * Edit is inline (textarea replaces body). Delete uses native
 * confirm(). No modal infrastructure (per chunk 4.7b spec).
 */

import { useState, useTransition } from "react";
import { Loader2, Pencil, Trash2, Check } from "lucide-react";
import {
  editFeedback,
  deleteFeedback,
  markFeedbackResolved,
} from "@/lib/actions/teacher-feedback";
import type { FeedbackItemRow } from "@/lib/queries/teacher-feedback";

interface Props {
  feedback: FeedbackItemRow;
  mode: "teacher" | "student";
  currentUserId: string;
}

export function FeedbackItem({ feedback, mode, currentUserId }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(feedback.body);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isOwnComment =
    mode === "teacher" && feedback.teacher_id === currentUserId;

  const onSaveEdit = () => {
    setError(null);
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      setError("Comment cannot be empty.");
      return;
    }
    start(async () => {
      try {
        await editFeedback(feedback.id, trimmed);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save edit.");
      }
    });
  };

  const onDelete = () => {
    if (!window.confirm("Delete this feedback comment?")) return;
    setError(null);
    start(async () => {
      try {
        await deleteFeedback(feedback.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not delete.");
      }
    });
  };

  const onResolve = () => {
    setError(null);
    start(async () => {
      try {
        await markFeedbackResolved(feedback.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not mark resolved.");
      }
    });
  };

  const authorName = formatAuthor(feedback.author);
  const timestamp = formatTimestamp(feedback.created_at);
  const wasEdited = feedback.updated_at !== feedback.created_at;

  return (
    <div
      className={`rounded-md border px-3 py-2.5 text-sm ${
        feedback.is_resolved
          ? "border-gray-200 bg-gray-50"
          : "border-blue-200 bg-blue-50/40"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-xs font-medium text-gray-700 truncate">
          {authorName}
        </div>
        <div className="text-[11px] text-gray-500 whitespace-nowrap">
          {timestamp}
          {wasEdited && " · edited"}
        </div>
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft(feedback.body);
                setError(null);
              }}
              disabled={pending}
              className="text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={pending}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {pending && <Loader2 className="w-3 h-3 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-gray-900 whitespace-pre-wrap break-words">
          {feedback.body}
        </p>
      )}

      {error && (
        <div className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </div>
      )}

      {!editing && (
        <div className="mt-2 flex items-center gap-3 text-xs">
          {isOwnComment && (
            <>
              <button
                type="button"
                onClick={() => {
                  setDraft(feedback.body);
                  setEditing(true);
                }}
                disabled={pending}
                className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 disabled:opacity-50"
              >
                <Pencil className="w-3 h-3" />
                Edit
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={pending}
                className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </>
          )}
          {mode === "student" && !feedback.is_resolved && (
            <button
              type="button"
              onClick={onResolve}
              disabled={pending}
              className="inline-flex items-center gap-1 text-green-700 hover:text-green-900 disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Mark resolved
            </button>
          )}
          {feedback.is_resolved && (
            <span className="inline-flex items-center gap-1 text-gray-500">
              <Check className="w-3 h-3" />
              Resolved
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function formatAuthor(
  author: FeedbackItemRow["author"]
): string {
  if (!author) return "Unknown";
  const parts = [author.first_name, author.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Teacher";
}

function formatTimestamp(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = 60 * 1000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
