/**
 * Teacher's combined read-only view of a student writing. Renders
 * every visible step's existing student-side component stacked
 * top-to-bottom, wrapped in <WritingModeProvider isReadOnly={true}>.
 *
 * Composition strategy: Option A (chunk 4.7b audit). The 4.7a
 * WritingModeProvider was designed for exactly this — leaf
 * components disable inputs and hide affordances when isReadOnly,
 * so the teacher sees what the student wrote with the same chrome.
 *
 * Per-step components fetch their own data. ~15-20 RLS-scoped
 * queries per page load. Acceptable at typical class scale; see
 * docs/BACKLOG.md for the perf-deferred unified-fetch alternative.
 *
 * Server component — every step component below is either a server
 * component or a "use client" boundary that this server component
 * is allowed to render. WritingModeProvider is "use client" but
 * accepts server-component children via React's standard pattern.
 */

import { MODES, getSteps, type JswpMode } from "@/lib/jswp-modes";
import { getPromptDecoding } from "@/lib/queries/prompt-decoding";
import { WritingModeProvider } from "@/components/student/writing/writing-mode-provider";
import { DecodePromptStep } from "@/app/student/writings/[id]/_steps/decode-prompt-step";
import { AnnotateTextStep } from "@/app/student/writings/[id]/_steps/annotate-text-step";
import { GatherCdsStep } from "@/app/student/writings/[id]/_steps/gather-cds-step";
import { TopicSentenceDevStep } from "@/app/student/writings/[id]/_steps/topic-sentence-dev-step";
import { TopicSentencesStep } from "@/app/student/writings/[id]/_steps/topic-sentences-step";
import { CmDevStep } from "@/app/student/writings/[id]/_steps/cm-dev-step";
import { DecisionsStep } from "@/app/student/writings/[id]/_steps/decisions-step";
import { ElaborationStep } from "@/app/student/writings/[id]/_steps/elaboration-step";
import { DiscoveryStep } from "@/app/student/writings/[id]/_steps/discovery-step";
import { TChartStep } from "@/app/student/writings/[id]/_steps/t-chart-step";
import { CounterargumentStep } from "@/app/student/writings/[id]/_steps/counterargument-step";
import { ShapingSheetStep } from "@/app/student/writings/[id]/_steps/shaping-sheet-step";
import { ThesisStep } from "@/app/student/writings/[id]/_steps/thesis-step";
import { IntroductionStep } from "@/app/student/writings/[id]/_steps/introduction-step";
import { ConclusionStep } from "@/app/student/writings/[id]/_steps/conclusion-step";
import { ParagraphFormStep } from "@/app/student/writings/[id]/_steps/paragraph-form-step";
import { FinalDraftStep } from "@/app/student/writings/[id]/_steps/final-draft-step";
import type { Database } from "@/lib/database.types";

type ChunkRatio = Database["public"]["Enums"]["jswp_chunk_ratio"];

interface Props {
  writingId: string;
  mode: JswpMode;
  chunkRatio: ChunkRatio;
  assignment: {
    prompt: string;
    is_essay: boolean;
    has_counterargument: boolean;
    source_text: string | null;
    source_title: string | null;
    source_author: string | null;
  };
}

export async function CombinedView({
  writingId,
  mode,
  chunkRatio,
  assignment,
}: Props) {
  const visible = getSteps(mode, {
    isEssay: assignment.is_essay,
    hasCounterargument: assignment.has_counterargument,
    hasSourceText: !!assignment.source_text,
    chunkRatio,
  });

  // Pre-fetch decode-prompt data (same pattern as the dispatcher;
  // decode-prompt's component takes pre-fetched props).
  const decoding = await getPromptDecoding(writingId);

  return (
    <WritingModeProvider isReadOnly={true}>
      <div className="space-y-12">
        {visible.map((step) => (
          <section
            key={step.key}
            className="border-l-2 border-gray-100 pl-4"
            aria-labelledby={`step-${step.key}`}
          >
            {renderStep({
              step,
              writingId,
              mode,
              chunkRatio,
              assignment,
              decoding,
            })}
          </section>
        ))}
      </div>
    </WritingModeProvider>
  );
}

interface RenderArgs {
  step: (typeof MODES)[JswpMode]["steps"][number];
  writingId: string;
  mode: JswpMode;
  chunkRatio: ChunkRatio;
  assignment: Props["assignment"];
  decoding: Awaited<ReturnType<typeof getPromptDecoding>>;
}

function renderStep({
  step,
  writingId,
  mode,
  chunkRatio,
  assignment,
  decoding,
}: RenderArgs) {
  const baseProps = {
    writingId,
    stepKey: step.key,
    stepLabel: step.label,
    pedagogyHint: step.pedagogyHint ?? null,
  };

  if (step.groupOrigin === "decode_prompt") {
    return (
      <DecodePromptStep
        writingId={writingId}
        assignmentPrompt={assignment.prompt}
        stepLabel={step.label}
        pedagogyHint={step.pedagogyHint ?? null}
        initial={{
          background_text: decoding?.background_text ?? "",
          trigger_text: decoding?.trigger_text ?? "",
          cd_source: decoding?.cd_source ?? "",
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

  if (step.groupOrigin === "annotate_text") {
    return (
      <AnnotateTextStep
        {...baseProps}
        sourceText={assignment.source_text}
        sourceTitle={assignment.source_title}
        sourceAuthor={assignment.source_author}
      />
    );
  }

  if (step.groupOrigin === "topic_sentence_dev") {
    if (mode === "argumentation") {
      return (
        <TopicSentenceDevStep
          {...baseProps}
          sourceText={assignment.source_text}
          sourceTitle={assignment.source_title}
          sourceAuthor={assignment.source_author}
        />
      );
    }
    if (mode === "narrative") {
      return <TopicSentencesStep {...baseProps} />;
    }
  }

  if (step.groupOrigin === "narrative_discovery") {
    return <DiscoveryStep {...baseProps} />;
  }

  if (step.groupOrigin === "literary_cm_dev") {
    return (
      <CmDevStep
        {...baseProps}
        sourceText={assignment.source_text}
        sourceTitle={assignment.source_title}
        sourceAuthor={assignment.source_author}
      />
    );
  }

  if (step.groupOrigin === "literary_decisions") {
    return (
      <DecisionsStep
        {...baseProps}
        sourceText={assignment.source_text}
        sourceTitle={assignment.source_title}
        sourceAuthor={assignment.source_author}
      />
    );
  }

  if (step.groupOrigin === "literary_elaboration") {
    return (
      <ElaborationStep
        {...baseProps}
        sourceText={assignment.source_text}
        sourceTitle={assignment.source_title}
        sourceAuthor={assignment.source_author}
      />
    );
  }

  if (step.groupOrigin === "gathering_cds") {
    return (
      <GatherCdsStep
        {...baseProps}
        sourceText={assignment.source_text}
        sourceTitle={assignment.source_title}
        sourceAuthor={assignment.source_author}
      />
    );
  }

  if (step.groupOrigin === "t_chart") {
    if (step.slug === "counterargument") {
      return <CounterargumentStep {...baseProps} />;
    }
    return (
      <TChartStep
        {...baseProps}
        mode={mode}
        chunkRatio={chunkRatio}
        sourceText={assignment.source_text}
        sourceTitle={assignment.source_title}
        sourceAuthor={assignment.source_author}
      />
    );
  }

  if (step.groupOrigin === "shaping_sheet") {
    return (
      <ShapingSheetStep
        {...baseProps}
        mode={mode}
        hasCounterargument={assignment.has_counterargument}
      />
    );
  }

  if (step.groupOrigin === "paragraph_form") {
    return (
      <ParagraphFormStep
        {...baseProps}
        isTerminal={false}
        mode={mode}
        hasCounterargument={assignment.has_counterargument}
      />
    );
  }

  if (step.groupOrigin === "thesis") {
    return <ThesisStep {...baseProps} />;
  }

  if (step.groupOrigin === "introduction") {
    return <IntroductionStep {...baseProps} mode={mode} />;
  }

  if (step.groupOrigin === "conclusion") {
    return <ConclusionStep {...baseProps} mode={mode} />;
  }

  if (step.groupOrigin === "final_draft") {
    return <FinalDraftStep {...baseProps} isTerminal={false} />;
  }

  return null;
}
