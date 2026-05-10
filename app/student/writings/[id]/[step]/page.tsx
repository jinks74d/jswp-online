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
import { AnnotateTextStep } from "../_steps/annotate-text-step";
import { TChartStep } from "../_steps/t-chart-step";
import { GatherCdsStep } from "../_steps/gather-cds-step";
import { TopicSentenceDevStep } from "../_steps/topic-sentence-dev-step";
import { CmDevStep } from "../_steps/cm-dev-step";
import { DecisionsStep } from "../_steps/decisions-step";
import { ElaborationStep } from "../_steps/elaboration-step";

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

  // Real step UIs: decode_prompt, annotate_text. Others render the
  // placeholder shim until their chunks land (4.4-4.6).
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

  if (target.groupOrigin === "annotate_text") {
    return (
      <AnnotateTextStep
        writingId={id}
        stepKey={target.key}
        stepLabel={target.label}
        pedagogyHint={target.pedagogyHint ?? null}
        sourceText={a.source_text}
        sourceTitle={a.source_title}
        sourceAuthor={a.source_author}
      />
    );
  }

  if (target.groupOrigin === "topic_sentence_dev") {
    // Argumentation's topic-sentence-development (chunk 4.5a) and
    // Narrative's topic-sentences (chunk 4.5c) share this groupOrigin
    // but render different UIs. Disambiguate by mode.
    if (mode === "argumentation") {
      return (
        <TopicSentenceDevStep
          writingId={id}
          stepKey={target.key}
          stepLabel={target.label}
          pedagogyHint={target.pedagogyHint ?? null}
          sourceText={a.source_text}
          sourceTitle={a.source_title}
          sourceAuthor={a.source_author}
        />
      );
    }
    // TODO(chunk-4.5c): replace this placeholder with the
    // narrative.topic_sentences UI (writes t_charts.working_topic_sentence
    // per BP). For now, fall through to the placeholder below.
  }

  if (target.groupOrigin === "literary_cm_dev") {
    return (
      <CmDevStep
        writingId={id}
        stepKey={target.key}
        stepLabel={target.label}
        pedagogyHint={target.pedagogyHint ?? null}
        sourceText={a.source_text}
        sourceTitle={a.source_title}
        sourceAuthor={a.source_author}
      />
    );
  }

  if (target.groupOrigin === "literary_decisions") {
    return (
      <DecisionsStep
        writingId={id}
        stepKey={target.key}
        stepLabel={target.label}
        pedagogyHint={target.pedagogyHint ?? null}
        sourceText={a.source_text}
        sourceTitle={a.source_title}
        sourceAuthor={a.source_author}
      />
    );
  }

  if (target.groupOrigin === "literary_elaboration") {
    return (
      <ElaborationStep
        writingId={id}
        stepKey={target.key}
        stepLabel={target.label}
        pedagogyHint={target.pedagogyHint ?? null}
        sourceText={a.source_text}
        sourceTitle={a.source_title}
        sourceAuthor={a.source_author}
      />
    );
  }

  if (target.groupOrigin === "gathering_cds") {
    return (
      <GatherCdsStep
        writingId={id}
        stepKey={target.key}
        stepLabel={target.label}
        pedagogyHint={target.pedagogyHint ?? null}
        sourceText={a.source_text}
        sourceTitle={a.source_title}
        sourceAuthor={a.source_author}
      />
    );
  }

  if (target.groupOrigin === "t_chart") {
    return (
      <TChartStep
        writingId={id}
        stepKey={target.key}
        stepLabel={target.label}
        pedagogyHint={target.pedagogyHint ?? null}
        mode={mode}
        chunkRatio={writing.chunk_ratio}
        sourceText={a.source_text}
        sourceTitle={a.source_title}
        sourceAuthor={a.source_author}
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
