"use client";

/**
 * Renders one body paragraph's gathering sheet: the optional
 * task_portion field at the top, then a two-section candidate list
 * — PRIORITY (selected, drag-reorderable) and BRAINSTORM (unselected)
 * — and an [Add candidate] button.
 *
 * Drag-and-drop reorders the PRIORITY list and persists each candidate's
 * selection_order via reorderSelectedCandidates. Visual priority numbers
 * are derived from list position (1..N), so any gaps in stored
 * selection_order from past deselections never surface.
 *
 * Optimistic UI: dragged order is held in local state and applied
 * immediately; the server action runs in a transition and revalidation
 * brings the canonical order back. If the server rejects, the next
 * render snaps the list back to truth.
 */

import { useEffect, useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AutoSaveInput } from "../t-chart/auto-save-input";
import { CandidateRow } from "./candidate-row";
import {
  createCandidate,
  reorderSelectedCandidates,
  updateSheetTaskPortion,
} from "@/lib/actions/candidate-cds";
import { useWritingMode } from "../use-writing-mode";
import type {
  CandidateData,
  GatheringSheetData,
} from "@/lib/queries/candidate-cds";

/* selection_order can be NULL while a candidate is selected if the
 * row was migrated from a pre-4.5 state, so sort defensively: nulls
 * (and equal orders) fall back to brainstorm position. */
function compareSelected(a: CandidateData, b: CandidateData): number {
  const ao = a.selection_order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.selection_order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.position - b.position;
}

function partition(candidates: readonly CandidateData[]): {
  selected: CandidateData[];
  unselected: CandidateData[];
} {
  const selected = candidates.filter((c) => c.is_selected).slice();
  const unselected = candidates.filter((c) => !c.is_selected).slice();
  selected.sort(compareSelected);
  unselected.sort((a, b) => a.position - b.position);
  return { selected, unselected };
}

export function SheetEditor({
  writingId,
  sheet,
}: {
  writingId: string;
  sheet: GatheringSheetData;
}) {
  const { isReadOnly } = useWritingMode();
  const { selected, unselected } = partition(sheet.candidates);
  const selectedCount = selected.length;

  // Local copy of the PRIORITY-list IDs in display order. Server is the
  // source of truth; this state exists only to avoid a snap-back flash
  // during the drop → revalidate round-trip.
  const [orderedIds, setOrderedIds] = useState<string[]>(() =>
    selected.map((c) => c.id)
  );
  const [, startReorder] = useTransition();

  // When server data changes (revalidate after toggle/add/delete/save),
  // re-sync our local order. Set comparison so a drag we already
  // applied locally doesn't overwrite itself.
  useEffect(() => {
    const serverIds = selected.map((c) => c.id);
    const sameMembers =
      serverIds.length === orderedIds.length &&
      serverIds.every((id) => orderedIds.includes(id));
    if (!sameMembers) {
      setOrderedIds(serverIds);
    }
    // Intentionally only depending on the serialized server order so
    // we don't double-fire on every parent rerender.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.map((c) => c.id).join(",")]);

  const idToCandidate = new Map(selected.map((c) => [c.id, c]));
  const orderedSelected = orderedIds
    .map((id) => idToCandidate.get(id))
    .filter((c): c is CandidateData => c !== undefined);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(next);
    startReorder(async () => {
      try {
        await reorderSelectedCandidates(writingId, sheet.id, next);
      } catch (err) {
        console.error("reorderSelectedCandidates failed", err);
        // Snap back on failure — server is truth.
        setOrderedIds(selected.map((c) => c.id));
      }
    });
  };

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
          <h4 className="text-sm font-semibold text-gray-900">
            Candidate concrete details
          </h4>
          <span className="text-xs text-gray-600">
            {sheet.candidates.length} brainstormed · {selectedCount} selected
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          List 4 or more. Check the box on the ones you want to use.
          Drag the selected ones into the order you want them to appear
          in your paragraph.
        </p>

        {sheet.candidates.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">
            No candidates yet. Click [Add candidate] to start brainstorming.
          </div>
        ) : (
          <div className="space-y-4">
            {orderedSelected.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-red-700">
                  <span>Priority</span>
                  {orderedSelected.length > 1 && (
                    <span className="text-gray-500 font-normal normal-case tracking-normal">
                      — drag to reorder
                    </span>
                  )}
                </div>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                >
                  <SortableContext
                    items={orderedIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {orderedSelected.map((c, idx) => (
                        <CandidateRow
                          key={c.id}
                          writingId={writingId}
                          candidate={c}
                          sortable
                          priorityNumber={idx + 1}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}

            {unselected.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <span>Brainstorm</span>
                  <span className="font-normal normal-case tracking-normal">
                    — not yet selected
                  </span>
                </div>
                <div className="space-y-2">
                  {unselected.map((c) => (
                    <CandidateRow
                      key={c.id}
                      writingId={writingId}
                      candidate={c}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!isReadOnly && (
          <div className="mt-3">
            <AddCandidateButton writingId={writingId} sheetId={sheet.id} />
          </div>
        )}
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
