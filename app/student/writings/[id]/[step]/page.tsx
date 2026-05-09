/**
 * Step dispatcher. Resolves the slug to a step config, enforces the
 * reachability gate (no skip-ahead), and renders either the real step
 * UI (decode-prompt for chunk 4.2) or the placeholder shim.
 *
 * Reachability rule: a step is reachable iff its index in the visible
 * step list is <= the index of the writing's current_step. Students may
 * always revisit earlier steps; URL-hacking past current → redirect to
 * current.
 */

import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getWriting } from "@/lib/queries/student-writings";
import { getPromptDecoding } from "@/lib/queries/prompt-decoding";
import { MODES, type JswpMode } from "@/lib/jswp-modes";
import { DecodePromptStep } from "../_steps/decode-prompt-step";
import { PlaceholderStep } from "../_steps/placeholder-step";

export const dynamic = "force-dynamic";

export default async function StepDispatcher({
  params,
}: {
  params: Promise<{ id: string; step: string }>;
}) {
  await requireRole("student");
  const { id, step: stepSlug } = await params;

  const writing = await getWriting(id);
  if (!writing) notFound();

  const a = writing.assignment;
  const mode = a.mode as JswpMode;
  const visible = MODES[mode].steps.filter((s) => {
    if (s.essayOnly && !a.is_essay) return false;
    if (s.requiresCounterargument && !a.has_counterargument) return false;
    if (s.requiresSourceText && !a.source_text) return false;
    return true;
  });

  const target = visible.find((s) => s.slug === stepSlug);
  if (!target) notFound();

  // Reachability gate: target index must be <= current_step index.
  const currentKey = writing.current_step ?? visible[0]?.key ?? "";
  const currentIdx = visible.findIndex((s) => s.key === currentKey);
  const targetIdx = visible.findIndex((s) => s.key === target.key);

  if (targetIdx > currentIdx) {
    const currentStep = visible[currentIdx] ?? visible[0];
    if (currentStep) {
      redirect(`/student/writings/${id}/${currentStep.slug}`);
    }
    notFound();
  }

  // Real step UI: decode_prompt. Everything else is a placeholder.
  if (target.groupOrigin === "decode_prompt") {
    const decoding = await getPromptDecoding(id);
    return (
      <DecodePromptStep
        writingId={id}
        assignmentPrompt={a.prompt}
        stepLabel={target.label}
        pedagogyHint={target.pedagogyHint ?? null}
        initial={{
          task: decoding?.task ?? "",
          form: decoding?.form ?? "",
          ratio_identified: decoding?.ratio_identified ?? "",
          key_verbs: decoding?.key_verbs ?? [],
          focus_terms: decoding?.focus_terms ?? [],
          notes: decoding?.notes ?? "",
        }}
      />
    );
  }

  return (
    <PlaceholderStep
      writingId={id}
      stepKey={target.key}
      stepLabel={target.label}
      pedagogyHint={target.pedagogyHint ?? null}
    />
  );
}
