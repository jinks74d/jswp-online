"use client";

/**
 * One candidate CD row: select checkbox (with optional priority badge
 * showing selection_order), text textarea (autosave), delete icon.
 *
 * The select checkbox toggles is_selected via setCandidateSelected;
 * the server action manages selection_order assignment internally.
 */

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { AutoSaveInput } from "../t-chart/auto-save-input";
import {
  setCandidateSelected,
  updateCandidateText,
  deleteCandidate,
} from "@/lib/actions/candidate-cds";
import type { CandidateData } from "@/lib/queries/candidate-cds";

export function CandidateRow({
  writingId,
  candidate,
}: {
  writingId: string;
  candidate: CandidateData;
}) {
  const [togglePending, toggleStart] = useTransition();
  const [deletePending, deleteStart] = useTransition();

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
      className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
        candidate.is_selected
          ? "border-red-300 bg-red-50/30"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex flex-col items-center pt-1">
        <input
          type="checkbox"
          checked={candidate.is_selected}
          disabled={togglePending}
          onChange={onToggleSelected}
          className="rounded border-gray-300 disabled:opacity-50"
          aria-label={
            candidate.is_selected
              ? "Deselect this candidate"
              : "Select this candidate to use in the T-chart"
          }
        />
        {candidate.is_selected && candidate.selection_order !== null && (
          <span
            className="mt-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-semibold"
            title={`Priority ${candidate.selection_order}`}
          >
            {candidate.selection_order}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <AutoSaveInput
          multiline
          rows={2}
          initialValue={candidate.text}
          placeholder="A concrete detail from the text or your knowledge…"
          onSave={async (text) => {
            await updateCandidateText(writingId, candidate.id, text);
          }}
        />
      </div>

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
    </div>
  );
}
