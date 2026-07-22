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
import { SectionFeedbackNote } from "./section-feedback-note";
import type { FeedbackItemRow } from "@/lib/queries/teacher-feedback";
import type { GradeFormat } from "@/lib/grade-format";
import type { Database } from "@/lib/database.types";

type ChunkRatio = Database["public"]["Enums"]["jswp_chunk_ratio"];

interface Props {
  writingId: string;
  mode: JswpMode;
  chunkRatio: ChunkRatio;
  feedbackByStep: ReadonlyMap<string, FeedbackItemRow>;
  gradeFormat: GradeFormat;
  assignment: {
    prompt: string;
    is_essay: boolean;
    has_counterargument: boolean;
    // Flat primary-source fields still feed the read-only reference panels in
    // later steps (topic-sentence-dev, cm-dev, t-chart, …). The annotate step
    // uses the full `sources` array below.
    source_text: string | null;
    source_title: string | null;
    source_author: string | null;
    source_file_path: string | null;
    source_file_name: string | null;
    sources: {
      id: string;
      kind: "primary" | "secondary";
      source_text: string | null;
      source_title: string | null;
      source_author: string | null;
      source_file_path: string | null;
      source_file_name: string | null;
    }[];
  };
}

export async function CombinedView({
  writingId,
  mode,
  chunkRatio,
  feedbackByStep,
  gradeFormat,
  assignment,
}: Props) {
  const visible = getSteps(mode, {
    isEssay: assignment.is_essay,
    hasCounterargument: assignment.has_counterargument,
    hasSourceText: assignment.sources.length > 0,
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
            // White surface (not the stone-100 page bg) so the read-only step
            // content — whose muted gray-500 labels are tuned for a white
            // background — keeps ≥4.5:1 contrast here too (WCAG 1.4.3).
            className="rounded-lg border border-gray-200 bg-white p-5"
            aria-label={step.label}
          >
            {renderStep({
              step,
              writingId,
              mode,
              chunkRatio,
              assignment,
              decoding,
            })}
            <SectionFeedbackNote
              writingId={writingId}
              stepKey={step.key}
              initialBody={feedbackByStep.get(step.key)?.body ?? ""}
              gradeFormat={gradeFormat}
              gradeValue={feedbackByStep.get(step.key)?.grade_value ?? ""}
            />
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

  // Read-only reference sources for downstream review panels. Teacher review
  // renders each source's flat substrate (sourceHtml null); annotations still
  // group per source via source_id.
  const refSources = assignment.sources.map((sc) => ({
    sourceId: sc.id,
    kind: sc.kind,
    sourceText: sc.source_text ?? "",
    sourceTitle: sc.source_title,
    sourceAuthor: sc.source_author,
    sourceFilePath: sc.source_file_path,
    sourceFileName: sc.source_file_name,
    sourceHtml: null,
  }));

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
    // Teacher review renders each source's flat substrate for now (renderMode
    // null → SourceTextViewer); PDF/rich-faithful review is Chunk 3 (spec §11),
    // out of scope here. Annotations still group per source via source_id.
    const reviewSources = assignment.sources.map((s) => ({
      sourceId: s.id,
      kind: s.kind,
      sourceText: s.source_text ?? "",
      sourceTitle: s.source_title,
      sourceAuthor: s.source_author,
      sourceFilePath: s.source_file_path,
      sourceFileName: s.source_file_name,
      sourceHtml: null,
      sourceRenderMode: null,
    }));
    return (
      <AnnotateTextStep
        {...baseProps}
        required={step.required}
        sources={reviewSources}
      />
    );
  }

  if (step.groupOrigin === "topic_sentence_dev") {
    if (mode === "argumentation") {
      return (
        <TopicSentenceDevStep
          {...baseProps}
          sources={refSources}
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
        sources={refSources}
      />
    );
  }

  if (step.groupOrigin === "literary_decisions") {
    return (
      <DecisionsStep
        {...baseProps}
        sources={refSources}
      />
    );
  }

  if (step.groupOrigin === "literary_elaboration") {
    return (
      <ElaborationStep
        {...baseProps}
        sources={refSources}
      />
    );
  }

  if (step.groupOrigin === "gathering_cds") {
    return (
      <GatherCdsStep
        {...baseProps}
        sources={refSources}
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
        sources={refSources}
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
    return <ThesisStep {...baseProps} mode={mode} />;
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
