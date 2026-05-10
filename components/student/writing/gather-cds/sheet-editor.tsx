"use client";

/**
 * Renders one body paragraph's gathering sheet: the optional
 * task_portion field at the top, then the candidate list, then an
 * [Add candidate] button. Selected candidates show a priority badge
 * matching their selection_order — that's the order promotion will
 * walk when the student visits the t-chart step.
 */

import { useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { AutoSaveInput } from "../t-chart/auto-save-input";
import { CandidateRow } from "./candidate-row";
import {
  createCandidate,
  updateSheetTaskPortion,
} from "@/lib/actions/candidate-cds";
import { useWritingMode } from "../use-writing-mode";
import type { GatheringSheetData } from "@/lib/queries/candidate-cds";

export function SheetEditor({
  writingId,
  sheet,
}: {
  writingId: string;
  sheet: GatheringSheetData;
}) {
  const { isReadOnly } = useWritingMode();
  const selectedCount = sheet.candidates.filter((c) => c.is_selected).length;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1">
          What part of the prompt does this paragraph address?
        </div>
        <p className="text-xs text-gray-500 mb-2">
          Optional — but worth noting if the prompt has multiple parts.
        </p>
        <AutoSaveInput
          multiline
          rows={2}
          initialValue={sheet.task_portion ?? ""}
          placeholder="e.g. 'the causes' or 'the effect on the speaker'"
          disabled={isReadOnly}
          onSave={async (taskPortion) => {
            await updateSheetTaskPortion(writingId, sheet.id, taskPortion);
          }}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Candidate concrete details
          </h3>
          <span className="text-xs text-gray-600">
            {sheet.candidates.length} brainstormed · {selectedCount} selected
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          List 4 or more. Check the box on the ones you want to use —
          they&apos;ll be carried over into the T-chart in the order you
          selected them.
        </p>

        <div className="space-y-2">
          {sheet.candidates.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">
              No candidates yet. Click [Add candidate] to start
              brainstorming.
            </div>
          ) : (
            sheet.candidates.map((c) => (
              <CandidateRow
                key={c.id}
                writingId={writingId}
                candidate={c}
              />
            ))
          )}

          {!isReadOnly && (
            <AddCandidateButton writingId={writingId} sheetId={sheet.id} />
          )}
        </div>
      </div>
    </div>
  );
}

function AddCandidateButton({
  writingId,
  sheetId,
}: {
  writingId: string;
  sheetId: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await createCandidate(writingId, sheetId);
        })
      }
      disabled={pending}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Plus className="w-4 h-4" />
      )}
      Add candidate
    </button>
  );
}
