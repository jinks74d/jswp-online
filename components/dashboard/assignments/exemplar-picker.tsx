"use client";

/**
 * Pin/unpin exemplars to an assignment (chunk 6.2).
 *
 * Lives inside the assignment form on edit pages only — needs an
 * assignment_id to bind pins to. Receives pinnable (teacher's published
 * exemplars in matching mode) and currentlyPinned from the server,
 * then mutates server-side via pinExemplar/unpinExemplar. Each action
 * revalidates the parent page so the lists re-fetch.
 *
 * UX:
 *   - Pinned list on top; each row has an "Unpin" button.
 *   - Picker below: dropdown of pinnable exemplars (excluding already-
 *     pinned). Selecting one pins it immediately.
 *   - Empty pinnable list: inline link to /dashboard/exemplars/new.
 *
 * No reorder UI in v1 — position column stays at 0; sort relies on
 * pinned_at.
 */

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { BookOpenCheck, Loader2, X } from "lucide-react";
import {
  pinExemplar,
  unpinExemplar,
} from "@/lib/actions/assignment-exemplars";
import type { PinnedExemplarRow, PinnableExemplarOption } from "@/lib/queries/assignment-exemplars";

interface Props {
  assignmentId: string;
  mode: "expository" | "argumentation" | "literary" | "narrative";
  pinned: readonly PinnedExemplarRow[];
  pinnable: readonly PinnableExemplarOption[];
}

const MODE_LABELS = {
  expository: "Expository",
  argumentation: "Argumentation",
  literary: "Literary",
  narrative: "Narrative",
} as const;

export function ExemplarPicker({
  assignmentId,
  mode,
  pinned,
  pinnable,
}: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pickerValue, setPickerValue] = useState<string>("");

  const pinnedIds = useMemo(
    () => new Set(pinned.map((p) => p.exemplar_id)),
    [pinned]
  );
  const available = useMemo(
    () => pinnable.filter((p) => !pinnedIds.has(p.id)),
    [pinnable, pinnedIds]
  );

  const onPin = (exemplarId: string) => {
    if (!exemplarId) return;
    setError(null);
    start(async () => {
      try {
        await pinExemplar(assignmentId, exemplarId);
        setPickerValue("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not pin exemplar.");
      }
    });
  };

  const onUnpin = (exemplarId: string) => {
    setError(null);
    start(async () => {
      try {
        await unpinExemplar(assignmentId, exemplarId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not unpin exemplar.");
      }
    });
  };

  return (
    <fieldset className="space-y-3">
      <legend className="block text-sm font-medium text-gray-800 mb-1">
        Reference exemplars
      </legend>
      <p className="text-xs text-gray-600">
        Pin published {MODE_LABELS[mode]} exemplars you&apos;ve authored.
        Students viewing this assignment will see pinned exemplars first.
        If you don&apos;t pin any, students see all your published{" "}
        {MODE_LABELS[mode]} exemplars instead.
      </p>

      {error && (
        <div className="text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {pinned.length > 0 && (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md bg-white">
          {pinned.map((p) => (
            <li
              key={p.exemplar_id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <BookOpenCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {p.title}
                    {!p.is_published && (
                      <span className="ml-2 inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        Draft
                      </span>
                    )}
                  </div>
                  {!p.ownedByViewer && (
                    <p className="text-xs text-purple-700">
                      Shared by {p.authorName ?? "a colleague"}
                    </p>
                  )}
                  {p.description && (
                    <p className="text-xs text-gray-600 truncate">
                      {p.description}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUnpin(p.exemplar_id)}
                disabled={pending}
                className="inline-flex items-center gap-1 text-xs text-gray-700 hover:text-red-700 disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <X className="w-3.5 h-3.5" />
                )}
                Unpin
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 ? (
        <div className="flex items-center gap-2">
          <select
            value={pickerValue}
            onChange={(e) => {
              const v = e.target.value;
              setPickerValue(v);
              if (v) onPin(v);
            }}
            disabled={pending}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
          >
            <option value="">
              {pinned.length > 0
                ? "Pin another exemplar…"
                : "Pin an exemplar…"}
            </option>
            {available.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.title}
                {!opt.ownedByViewer
                  ? ` — Shared by ${opt.authorName ?? "a colleague"}`
                  : ""}
              </option>
            ))}
          </select>
        </div>
      ) : pinned.length === 0 ? (
        <div className="text-sm text-gray-600 border border-dashed border-gray-300 rounded-md px-3 py-3">
          No {MODE_LABELS[mode]} exemplars available yet.{" "}
          <Link
            href="/dashboard/exemplars/new"
            className="text-blue-600 hover:text-blue-800"
          >
            Create one
          </Link>
          {" "}
          or ask a colleague to share theirs.
        </div>
      ) : (
        <p className="text-xs text-gray-500">
          All available {MODE_LABELS[mode]} exemplars are pinned.
        </p>
      )}
    </fieldset>
  );
}
