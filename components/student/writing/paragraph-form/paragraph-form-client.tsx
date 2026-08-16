"use client";

/**
 * Paragraph-form orchestrator. Per-BP tabs; routes each BP to either
 * cd-cm-paragraph-form-bp-pane or narrative-paragraph-form-bp-pane
 * based on mode.
 *
 * Continue gate: each BP must have non-empty (trimmed) final_text. Names the
 * offending BP.
 *
 * On the terminal step this is where a student SUBMITS the whole writing, so
 * Continue confirms first. That confirm stays here rather than in StepShell:
 * it is specific to handing work in, and a shell that could interrupt every
 * step's Continue would be a footgun for the other eight.
 *
 * Tabs, layout and footer come from StepShell.
 */

import { CdCmParagraphFormBpPane } from "./cd-cm-paragraph-form-bp-pane";
import { NarrativeParagraphFormBpPane } from "./narrative-paragraph-form-bp-pane";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import { useServerAction } from "@/hooks/use-server-action";
import { narrativeBpLabel } from "@/lib/narrative-bp-labels";
import type { ParagraphFormBpData } from "@/lib/queries/paragraph-form";
import type { Database } from "@/lib/database.types";
import { StepShell, type StepGate } from "../step-shell";

type Mode = Database["public"]["Enums"]["jswp_mode"];

interface Props {
  writingId: string;
  stepKey: string;
  isTerminal: boolean;
  mode: Mode;
  hasCounterargument: boolean;
  bps: readonly ParagraphFormBpData[];
}

function computeGate(
  bps: readonly ParagraphFormBpData[],
  isTerminal: boolean
): StepGate {
  for (const bp of bps) {
    const text = bp.paragraph_form?.final_text ?? "";
    if (text.trim().length === 0) {
      return {
        canContinue: false,
        message: `Body paragraph ${bp.position} needs at least one character of polished paragraph text.`,
      };
    }
  }
  return {
    canContinue: true,
    message: isTerminal
      ? "All body paragraphs ready to submit."
      : "Each body paragraph has a polished paragraph.",
  };
}

export function ParagraphFormClient({
  writingId,
  stepKey,
  isTerminal,
  mode,
  hasCounterargument,
  bps,
}: Props) {
  const { pending, error, setError, run } = useServerAction();
  const isNarrative = mode === "narrative";

  const onContinue = () => {
    // Cleared before the confirm so declining the dialog also dismisses a
    // stale message; run() would never be reached on that path.
    setError(null);
    if (isTerminal) {
      const ok = window.confirm(
        "Submit your writing for review? You won't be able to edit until it's returned."
      );
      if (!ok) return;
    }
    run(() => completeStepAndAdvance(writingId, stepKey));
  };

  return (
    <StepShell
      writingId={writingId}
      stepKey={stepKey}
      items={bps}
      itemKey={(bp) => bp.id}
      tabLabel={(bp) =>
        narrativeBpLabel(
          bp.narrative_kind,
          bp.narrative_subject,
          bp.position,
          bps.length
        )
      }
      renderPane={(bp) =>
        isNarrative ? (
          <NarrativeParagraphFormBpPane writingId={writingId} bp={bp} />
        ) : (
          <CdCmParagraphFormBpPane
            writingId={writingId}
            bp={bp}
            hasCounterargument={hasCounterargument}
          />
        )
      }
      emptyMessage="No body paragraphs yet."
      gate={computeGate(bps, isTerminal)}
      onContinue={onContinue}
      pending={pending}
      error={error}
      isTerminal={isTerminal}
    />
  );
}
