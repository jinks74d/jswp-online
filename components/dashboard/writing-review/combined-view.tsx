/**
 * Teacher's combined read-only view of a student writing. Renders
 * every visible step's existing student-side component stacked
 * top-to-bottom, wrapped in <WritingModeProvider isReadOnly={true}>.
 *
 * Reading order is the teacher's, not the student's: the finished writing
 * comes first, then the process that produced it (see lib/review-order.ts).
 * She reads the final paragraph, and only when something is wrong with it
 * goes back through the scaffolding to find where.
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

import { Check } from "lucide-react";
import { MODES, getSteps, type JswpMode } from "@/lib/jswp-modes";
import { orderStepsForReview } from "@/lib/review-order";
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
  /** step_key -> when the student submitted it for grading (migration 0055). */
  submittedSteps: ReadonlyMap<string, string>;
  gradeFormat: GradeFormat;
  assignment: {
    prompt: string;
    is_essay: boolean;
    has_counterargument: boolean;
    sources: {
      id: string;
      kind: "primary" | "secondary";
      source_text: string | null;
      source_title: string | null;
      source_author: string | null;
      source_file_path: string | null;
      source_file_name: string | null;
      source_render_mode: "pdf" | "rich" | "plain" | "image" | null;
    }[];
  };
}

export async function CombinedView({
  writingId,
  mode,
  chunkRatio,
  feedbackByStep,
  submittedSteps,
  gradeFormat,
  assignment,
}: Props) {
  const visible = getSteps(mode, {
    isEssay: assignment.is_essay,
    hasCounterargument: assignment.has_counterargument,
    hasSourceText: assignment.sources.length > 0,
    chunkRatio,
  });

  const { outcome, process } = orderStepsForReview(visible);

  // Pre-fetch decode-prompt data (same pattern as the dispatcher;
  // decode-prompt's component takes pre-fetched props).
  const decoding = await getPromptDecoding(writingId);

  const section = (step: (typeof visible)[number]) => (
    <section
      key={step.key}
      // White surface (not the stone-100 page bg) so the read-only step
      // content — whose muted gray-500 labels are tuned for a white
      // background — keeps ≥4.5:1 contrast here too (WCAG 1.4.3).
      className="rounded-lg border border-gray-200 bg-white p-5"
      aria-label={step.label}
    >
      {submittedSteps.has(step.key) && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-green-300 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-900">
          <Check className="h-3 w-3" aria-hidden="true" />
          Submitted for grading{" "}
          {formatRelative(submittedSteps.get(step.key) as string)}
        </div>
      )}
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
  );

  return (
    <WritingModeProvider isReadOnly={true}>
      <div className="space-y-12">
        {outcome.map(section)}

        {/* Names the break so leading with the finished writing reads as
            intentional rather than as a mis-ordered list. Only earns its space
            when there is something on both sides of it. */}
        {outcome.length > 0 && process.length > 0 && (
          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-stone-300" />
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-600">
              How they got there
            </span>
            <span className="h-px flex-1 bg-stone-300" />
          </div>
        )}

        {process.map(section)}
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
    // Deliberately flattened for pdf/rich (above), but an image source has no
    // flat substrate at all — pass 'image' through or the panel renders blank.
    sourceRenderMode:
      sc.source_render_mode === "image" ? ("image" as const) : null,
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
      // See refSources: 'image' must survive the flattening or there is
      // nothing left to show.
      sourceRenderMode:
        s.source_render_mode === "image" ? ("image" as const) : null,
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

/** Relative time for the per-step submitted badge. */
function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
