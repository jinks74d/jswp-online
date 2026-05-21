"use client";

/**
 * One candidate CD row: select checkbox, text textarea (autosave),
 * delete icon, and — when `sortable` and `priorityNumber` are passed
 * — a drag handle on the left plus a visible priority badge.
 *
 * Drag handle is wired with @dnd-kit/sortable's useSortable. The
 * handle's listeners are deliberately scoped to the handle element
 * only, so dragging never starts inside the textarea (which would
 * make text-selection impossible).
 */

import { useTransition } from "react";
import { GripVertical, Loader2, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AutoSaveInput } from "../t-chart/auto-save-input";
import {
  setCandidateSelected,
  updateCandidateText,
  deleteCandidate,
} from "@/lib/actions/candidate-cds";
import { useWritingMode } from "../use-writing-mode";
import type { CandidateData } from "@/lib/queries/candidate-cds";

interface Props {
  writingId: string;
  candidate: CandidateData;
  // When true, render a drag handle and wire useSortable. The candidate's
  // id is used as the sortable id.
  sortable?: boolean;
  // Display-priority number for the badge (1..N). Independent from
  // the stored selection_order — the sheet editor renumbers visually
  // so gaps from past deselections never show.
  priorityNumber?: number;
}

export function CandidateRow({
  writingId,
  candidate,
  sortable = false,
  priorityNumber,
}: Props) {
  const { isReadOnly } = useWritingMode();
  const [togglePending, toggleStart] = useTransition();
  const [deletePending, deleteStart] = useTransition();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: candidate.id,
    disabled: !sortable || isReadOnly,
  });

  const style = sortable
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.12)" : undefined,
      }
    : undefined;

  const onToggleSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.checked;
    toggleStart(async () => {
      await setCandidateSelected(writingId, candidate.id, next);
    });
  };

  const onDelete = () => {
    deleteStart(async () => {
      await deleteCandidate(writingId, candidate.id);
    });
  };

  return (
    <div
      ref={sortable ? setNodeRef : undefined}
      style={style}
      className={`flex items-start gap-2 rounded-md border p-3 transition-colors ${
        candidate.is_selected
          ? "border-red-300 bg-red-50/30"
          : "border-gray-200 bg-white"
      } ${isDragging ? "opacity-90" : ""}`}
    >
      {sortable && (
        <button
          type="button"
          aria-label="Reorder candidate"
          {...attributes}
          {...listeners}
          disabled={isReadOnly}
          className="mt-1 text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing touch-none disabled:opacity-50"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}

      <div className="flex flex-col items-center pt-1">
        <input
          type="checkbox"
          checked={candidate.is_selected}
          disabled={togglePending || isReadOnly}
          onChange={onToggleSelected}
          className="rounded border-gray-300 disabled:opacity-50"
          aria-label={
            candidate.is_selected
              ? "Deselect this candidate"
              : "Select this candidate to use in the T-chart"
          }
        />
        {candidate.is_selected && priorityNumber !== undefined && (
          <span
            className="mt-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-semibold"
            title={`Priority ${priorityNumber}`}
          >
            {priorityNumber}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <AutoSaveInput
          multiline
          rows={2}
          initialValue={candidate.text}
          placeholder="A concrete detail from the text or your knowledge…"
          disabled={isReadOnly}
          onSave={async (text) => {
            await updateCandidateText(writingId, candidate.id, text);
          }}
        />
      </div>

      {!isReadOnly && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deletePending}
          title="Remove candidate"
          className="mt-1 text-gray-400 hover:text-red-700 disabled:opacity-50"
        >
          {deletePending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );
}
