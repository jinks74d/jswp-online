"use client";

/**
 * Topic Sentences orchestrator (Narrative only). Single-screen
 * layout — `repeatPerBP: false` per the step config means all BPs'
 * TS textareas stack on one page rather than tabbed.
 *
 * Per BP section:
 *   - "Body paragraph N" subheader
 *   - Read-only discovery context (key_word + concrete_example)
 *     anchoring the TS in what the student discovered. If both
 *     are empty, render a back-link panel pointing at the
 *     discovery step.
 *   - working_topic_sentence textarea (autosave on blur)
 *
 * Continue gate: each BP's working_topic_sentence non-empty
 * (trimmed). Tooltip names the offending BP.
 *
 * On Continue with a violation: scroll the offending BP textarea
 * into view as a usability nicety.
 */

import Link from "next/link";
import { forwardRef, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { AutoSaveInput } from "../t-chart/auto-save-input";
import { updateTChart } from "@/lib/actions/t-charts";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import { useWritingMode } from "../use-writing-mode";
import type { BodyParagraphData } from "@/lib/queries/t-charts";

interface Props {
  writingId: string;
  stepKey: string;
  bps: readonly BodyParagraphData[];
}

interface GateResult {
  canContinue: boolean;
  blockerPosition: number | null;
}

function computeGate(bps: readonly BodyParagraphData[]): GateResult {
  for (const bp of bps) {
    const ts = bp.t_chart?.working_topic_sentence;
    if (!ts || !ts.trim()) {
      return { canContinue: false, blockerPosition: bp.position };
    }
  }
  return { canContinue: true, blockerPosition: null };
}

export function TopicSentencesClient({ writingId, stepKey, bps }: Props) {
  const { isReadOnly } = useWritingMode();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const sectionRefs = useRef<Map<number, HTMLElement>>(new Map());

  const gate = computeGate(bps);

  const onContinue = () => {
    setError(null);
    if (!gate.canContinue && gate.blockerPosition !== null) {
      const target = sectionRefs.current.get(gate.blockerPosition);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    start(async () => {
      try {
        await completeStepAndAdvance(writingId, stepKey);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NEXT_REDIRECT") return;
        setError(msg || "Could not continue.");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {bps.map((bp, i) => (
          <BpSection
            key={bp.id}
            ref={(el) => {
              if (el) sectionRefs.current.set(bp.position, el);
              else sectionRefs.current.delete(bp.position);
            }}
            writingId={writingId}
            bp={bp}
            tinted={i % 2 === 1}
          />
        ))}
      </div>

      {!isReadOnly && (
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            {gate.canContinue
              ? `${bps.length} topic sentence${bps.length === 1 ? "" : "s"} ready.`
              : `Body paragraph ${gate.blockerPosition} below needs a topic sentence.`}
          </div>
          <div className="flex items-center gap-3">
            {error && (
              <div className="text-sm text-red-700" role="alert">
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={onContinue}
              disabled={pending}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: gate.canContinue
                  ? "var(--district-primary)"
                  : "rgb(156 163 175)", // gray-400 — visible but signals "not ready"
              }}
              title={
                gate.canContinue
                  ? undefined
                  : `Body paragraph ${gate.blockerPosition} below needs a topic sentence`
              }
            >
              {pending && <Loader2 className="w-4 h-4 animate-spin" />}
              {pending ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface BpSectionProps {
  writingId: string;
  bp: BodyParagraphData;
  tinted: boolean;
}

const BpSection = forwardRef<HTMLElement, BpSectionProps>(function BpSection(
  { writingId, bp, tinted },
  ref
) {
  const { isReadOnly } = useWritingMode();
  const tc = bp.t_chart;
  const keyWord = tc?.narrative_key_word?.trim() ?? "";
  const concreteExample = tc?.narrative_concrete_example?.trim() ?? "";
  const hasContext = keyWord.length > 0 || concreteExample.length > 0;

  return (
    <section
      ref={ref}
      className={`border ${
        tinted ? "bg-gray-50" : "bg-white"
      } border-gray-200 rounded-lg p-4 space-y-3`}
    >
      <header>
        <div className="text-xs uppercase tracking-wide text-gray-500">
          Body paragraph {bp.position}
        </div>
      </header>

      {hasContext ? (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-amber-900 mb-0.5">
            From your discovery
          </div>
          <div className="text-sm text-gray-900">
            {keyWord && <span className="font-semibold">{keyWord}</span>}
            {keyWord && concreteExample && (
              <span className="text-gray-500"> — </span>
            )}
            {concreteExample && (
              <span className="line-clamp-2">{concreteExample}</span>
            )}
          </div>
        </div>
      ) : (
        <BackToDiscoveryPanel writingId={writingId} />
      )}

      {tc ? (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-1">
            Working Topic Sentence
          </div>
          <p className="text-xs text-gray-500 mb-2">
            A feeling or insight that reflects on the moment you&apos;ll
            narrate.
          </p>
          <AutoSaveInput
            multiline
            rows={2}
            initialValue={tc.working_topic_sentence ?? ""}
            placeholder="Write the topic sentence for this paragraph…"
            disabled={isReadOnly}
            onSave={async (working_topic_sentence) => {
              await updateTChart(writingId, tc.id, {
                working_topic_sentence,
              });
            }}
          />
        </div>
      ) : (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
          T-chart row missing for this BP. Reload to bootstrap.
        </div>
      )}
    </section>
  );
});

function BackToDiscoveryPanel({ writingId }: { writingId: string }) {
  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm">
      <p className="text-amber-900">
        No discovery yet for this body paragraph.
      </p>
      <Link
        href={`/student/writings/${writingId}/discovery`}
        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-300 bg-white text-xs text-amber-900 hover:bg-amber-50"
      >
        ← Back to Discovering the Topic
      </Link>
    </div>
  );
}
