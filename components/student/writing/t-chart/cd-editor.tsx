"use client";

/**
 * CD editor: concrete-detail text + the "Embedding Quotations" (TLCD)
 * affordance — a "Mark as quotation" toggle that reveals Lead-in and
 * Citation fields.
 *
 * Shared by the Expository CD | CM grid (expository-chunk-grid.tsx) and
 * the argumentation / literary T-Chart (chunk-editor.tsx). Extracted from
 * expository-chunk-grid.tsx in the "mirror TLCD UI" chunk so all three
 * modes get the same affordance — embedding quotations is canonical for
 * expository / argumentation / literary (schema 0001:425, CLAUDE.md §4,
 * guide pp.77–78).
 *
 * The fields feed the T-Chart only — the student weaves the assembled
 * quote into a CD sentence on the Shaping Sheet (Paragraph Form composes
 * from there, not from concrete_details). Toggling off is non-destructive:
 * the action keeps stored lead-in/citation; we just collapse the inputs.
 * The delete button is intentionally left to the caller so each layout
 * places it where it wants.
 *
 * Quotation marks are the STUDENT's job (decision: Raymond, 2026-07-26), and
 * a missing pair is flagged inline because it blocks Continue — placing the
 * marks correctly is the skill being taught.
 *
 * There is no assembled-quotation preview here (removed 2026-08-13). The
 * lead-in, quote and citation are woven together by the student on the
 * Shaping Sheet, which is where that work belongs; showing a machine-composed
 * version on the T-Chart pre-empted the exercise and crowded the left column.
 */

import { useState, useTransition } from "react";
import { AutoSaveInput } from "./auto-save-input";
import {
  updateConcreteDetail,
  setConcreteDetailQuotation,
} from "@/lib/actions/t-charts";
import { hasQuotationPair } from "@/lib/quotation-marks";
import type { ConcreteDetailData } from "@/lib/queries/t-charts";

const DEFAULT_CD_PLACEHOLDER =
  "Write a concrete detail from the text or your knowledge…";

export function CdEditor({
  writingId,
  cd,
  disabled,
  placeholder = DEFAULT_CD_PLACEHOLDER,
}: {
  writingId: string;
  cd: ConcreteDetailData;
  disabled: boolean;
  placeholder?: string;
}) {
  const [isQuotation, setIsQuotation] = useState(cd.is_quotation);
  const [pending, start] = useTransition();

  const toggleQuotation = () => {
    const next = !isQuotation;
    setIsQuotation(next); // optimistic
    start(async () => {
      try {
        await setConcreteDetailQuotation(writingId, cd.id, { isQuotation: next });
      } catch (e) {
        console.error("toggle quotation:", e);
        setIsQuotation(!next); // revert on failure
      }
    });
  };

  const quote = cd.text.trim();
  // Blocks Continue on the T-Chart (see computeGate in t-chart-client.tsx),
  // so this reads as a required fix rather than a suggestion. Only fires
  // once there is text to judge — an empty CD isn't yet a mistake.
  const needsQuotationMarks =
    isQuotation && quote.length > 0 && !hasQuotationPair(quote);

  return (
    <div className="space-y-2">
      <AutoSaveInput
        multiline
        rows={2}
        initialValue={cd.text}
        placeholder={
          isQuotation
            ? 'Type the exact words you’re quoting, with "quotation marks" around them — keep it short (under ~7 words)…'
            : placeholder
        }
        disabled={disabled}
        className="text-[color:var(--jswp-color-cd)]"
        onSave={async (text) => {
          await updateConcreteDetail(writingId, cd.id, text);
        }}
      />

      <label className="flex items-center gap-1.5 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={isQuotation}
          onChange={toggleQuotation}
          disabled={disabled || pending}
          className="h-3.5 w-3.5 rounded border-gray-500"
          style={{ accentColor: "var(--jswp-color-cd)" }}
        />
        Mark as quotation
      </label>

      {isQuotation && (
        <div className="space-y-1.5 rounded-md border border-dashed border-gray-300 bg-gray-50/60 p-2">
          <div className="text-base font-medium text-gray-600">
            Lead-in{" "}
            <span className="font-normal text-gray-600">
              (After, Although, Before, Because, If, Since, When, While…)
            </span>
          </div>
          <AutoSaveInput
            multiline
            rows={2}
            initialValue={cd.transitional_lead_in ?? ""}
            placeholder="Set up the quote — what happens right before it?"
            disabled={disabled}
            onSave={async (value) => {
              await setConcreteDetailQuotation(writingId, cd.id, {
                isQuotation: true,
                transitionalLeadIn: value,
              });
            }}
          />
          <div className="text-base font-medium text-gray-600">Citation</div>
          <AutoSaveInput
            initialValue={cd.source_citation ?? ""}
            placeholder="(Author 78)"
            disabled={disabled}
            onSave={async (value) => {
              await setConcreteDetailQuotation(writingId, cd.id, {
                isQuotation: true,
                sourceCitation: value,
              });
            }}
          />
        </div>
      )}

      {needsQuotationMarks && (
        <p className="text-xs font-medium text-red-700" role="status">
          Add “quotation marks” around the exact words you took from the text —
          at the beginning and at the end of the quote. You’ll need them before
          you can continue.
        </p>
      )}
    </div>
  );
}
