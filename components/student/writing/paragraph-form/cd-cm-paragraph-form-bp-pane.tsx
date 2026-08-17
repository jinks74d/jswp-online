"use client";

/**
 * One body paragraph's paragraph-form pane for expository /
 * argumentation / literary modes. Rebuilt in chunk 4.5d-3.
 *
 * The artifact is the assembled paragraph in JSWP color — composed
 * automatically from the tagged Shaping Sheet sentences (TS blue →
 * per-chunk CD red + CM green → CS blue), per the guide's Paragraph
 * Form (docs/reference/expository-organizer-specs.md). The student
 * reads and confirms; they don't retype.
 *
 * Layout:
 *   Left (aside): read-only discrete-sentence material from shaping.
 *   Right (main): the composed COLOR-CODED paragraph + an optional
 *                 "fine-tune wording" editor (final_text) with word count.
 *
 * final_text contract: Final Draft assembly reads paragraph_forms.final_text
 * (lib/actions/final-draft.ts). We auto-seed final_text from the composed
 * text once, only while it is still empty, so the Continue gate passes and
 * the essay assembles — without ever clobbering a student's manual edit.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import {
  updateFinalText,
  resyncFinalTextToCompose,
} from "@/lib/actions/paragraph-form";
import {
  composeParagraphSegments,
  composeParagraphText,
  type SegmentRole,
} from "@/lib/compose-paragraph";
import { useWritingMode } from "../use-writing-mode";
import { NotWrittenYet } from "../not-written-yet";
import type { ParagraphFormBpData } from "@/lib/queries/paragraph-form";

// Static literal classes so Tailwind's scanner generates them.
const SEGMENT_TEXT_CLASS: Record<SegmentRole, string> = {
  ts: "text-[color:var(--jswp-color-ts)]",
  cd: "text-[color:var(--jswp-color-cd)]",
  cm: "text-[color:var(--jswp-color-cm)]",
  cs: "text-[color:var(--jswp-color-cs)]",
  other: "text-gray-900",
};

const SEGMENT_SR_LABEL: Record<SegmentRole, string> = {
  ts: "Topic sentence",
  cd: "Concrete detail",
  cm: "Commentary",
  cs: "Concluding sentence",
  other: "",
};

export function CdCmParagraphFormBpPane({
  writingId,
  bp,
  hasCounterargument,
}: {
  writingId: string;
  bp: ParagraphFormBpData;
  hasCounterargument: boolean;
}) {
  const pf = bp.paragraph_form;
  if (!pf) {
    return <NotWrittenYet artifact="final paragraph" />;
  }

  // Compose from the final (falling back to working) topic/concluding
  // sentences plus the per-chunk shaped sentence arrays.
  const ts =
    bp.shaping?.final_topic_sentence?.trim() ||
    bp.working_topic_sentence?.trim() ||
    "";
  const cs =
    bp.shaping?.final_concluding_sentence?.trim() ||
    bp.concluding_sentence?.trim() ||
    "";

  const composeInput = {
    topicSentence: ts,
    chunks: bp.chunks.map((c) => ({
      cd_sentences: c.cd_sentences,
      cm_sentences: c.cm_sentences,
    })),
    concession: hasCounterargument ? bp.shaping?.final_concession : null,
    counterargument: hasCounterargument
      ? bp.shaping?.final_counterargument
      : null,
    refutation: hasCounterargument ? bp.shaping?.final_refutation : null,
    concludingSentence: cs,
  };
  const segments = composeParagraphSegments(composeInput);
  const composedText = composeParagraphText(composeInput);

  return (
    <>
      {/* Mobile: read-only material as collapsible at top */}
      <details className="lg:hidden bg-white border border-gray-200 rounded-lg group mb-3">
        <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900">
            Your sentence material
          </span>
          <span className="text-xs text-gray-500 group-open:hidden">Show</span>
          <span className="text-xs text-gray-500 hidden group-open:inline">
            Hide
          </span>
        </summary>
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <ReadOnlyMaterial
            writingId={writingId}
            bp={bp}
            hasCounterargument={hasCounterargument}
          />
        </div>
      </details>

      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
          <ReadOnlyMaterial
            writingId={writingId}
            bp={bp}
            hasCounterargument={hasCounterargument}
          />
        </aside>

        <div className="space-y-4 min-w-0">
          <ComposedParagraph segments={segments} writingId={writingId} />
          <Editor
            writingId={writingId}
            paragraphFormId={pf.id}
            initialValue={pf.final_text}
            composedText={composedText}
            customized={pf.final_text_customized}
          />
        </div>
      </div>
    </>
  );
}

/* ─── Composed color-coded paragraph (the artifact) ───────────────── */

function ComposedParagraph({
  segments,
  writingId,
}: {
  segments: ReturnType<typeof composeParagraphSegments>;
  writingId: string;
}) {
  if (segments.length === 0) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-700">
          Your paragraph
        </div>
        <BackLinkNotice
          writingId={writingId}
          message="Nothing to assemble yet — finish your Shaping Sheet first."
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-700">
        Your paragraph
      </div>
      <p className="text-xs text-gray-500">
        Assembled in color from your shaped sentences. Read it through — blue
        topic &amp; concluding sentences, red concrete details, green
        commentary.
      </p>
      <div
        className="rounded-md border border-gray-200 bg-white p-4 text-sm leading-7"
        style={{ textIndent: "1.5rem", printColorAdjust: "exact" }}
      >
        {segments.map((seg, i) => (
          <span key={i} className={SEGMENT_TEXT_CLASS[seg.role]}>
            {SEGMENT_SR_LABEL[seg.role] && (
              <span className="sr-only">{SEGMENT_SR_LABEL[seg.role]}: </span>
            )}
            {seg.text}
            {i < segments.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Optional fine-tune editor (overrides final_text) ────────────── */

/**
 * Editable final_text with live word count + onBlur autosave. final_text
 * is auto-synced from the composed paragraph server-side (see
 * lib/actions/paragraph-form → syncParagraphForms) until the student
 * edits here, which flips final_text_customized = true and stops the
 * auto-sync so their wording is preserved. "Reset to auto-composed"
 * clears the flag and re-adopts the live composed paragraph.
 */
function Editor({
  writingId,
  paragraphFormId,
  initialValue,
  composedText,
  customized,
}: {
  writingId: string;
  paragraphFormId: string;
  initialValue: string;
  composedText: string;
  customized: boolean;
}) {
  const { isReadOnly } = useWritingMode();
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [resyncing, startResync] = useTransition();
  const isFocusedRef = useRef(false);
  const lastSavedRef = useRef(initialValue);

  // Pick up server prop refresh when not actively editing (the auto-sync
  // and the post-save revalidate both flow new final_text in through here).
  useEffect(() => {
    if (!isFocusedRef.current) {
      setValue(initialValue);
      lastSavedRef.current = initialValue;
    }
  }, [initialValue]);

  const handleBlur = async () => {
    isFocusedRef.current = false;
    if (value === lastSavedRef.current) return;
    setStatus("saving");
    try {
      await updateFinalText(writingId, paragraphFormId, value);
      lastSavedRef.current = value;
      setStatus("saved");
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch (e) {
      console.error("paragraph-form save:", e);
      setStatus("error");
    }
  };

  const onReset = () => {
    startResync(async () => {
      try {
        await resyncFinalTextToCompose(
          writingId,
          paragraphFormId,
          composedText
        );
      } catch (e) {
        console.error("paragraph-form resync:", e);
      }
    });
  };

  const wordCount = countWords(value);

  return (
    <div className="space-y-2">
      {customized && !isReadOnly && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>
            You&apos;ve fine-tuned this paragraph, so it no longer updates
            automatically when your sentences change.
          </span>
          <button
            type="button"
            onClick={onReset}
            disabled={resyncing}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2 py-1 font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            {resyncing && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Reset to auto-composed
          </button>
        </div>
      )}

      <details className="rounded-md border border-gray-200 bg-white group">
      <summary className="px-3 py-2 cursor-pointer list-none flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">
          Fine-tune wording (optional)
        </span>
        <span className="text-xs text-gray-500 group-open:hidden">Open</span>
        <span className="text-xs text-gray-500 hidden group-open:inline">
          Close
        </span>
      </summary>
      <div className="px-3 pb-3 space-y-2 border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-500">
          The paragraph above is assembled for you. Adjust wording or
          transitions here if you want — this is what gets submitted.
        </p>
        <div className="relative">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => {
              isFocusedRef.current = true;
            }}
            onBlur={handleBlur}
            disabled={isReadOnly}
            rows={10}
            placeholder="Your assembled paragraph…"
            className="w-full rounded-md border border-gray-500 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
          />
          <span
            className="absolute right-2 top-2 text-xs text-gray-500 pointer-events-none"
            aria-live="polite"
          >
            {status === "saving" && "Saving…"}
            {status === "saved" && <span className="text-green-600">Saved</span>}
            {status === "error" && <span className="text-red-600">Retry?</span>}
          </span>
        </div>
        <div className="text-xs text-gray-500">Word count: {wordCount}</div>
      </div>
    </details>
    </div>
  );
}

function countWords(text: string): number {
  const t = text.trim();
  if (t.length === 0) return 0;
  return t.split(/\s+/).length;
}

/* ─── Read-only material (left column on desktop) ─────────────────── */

function ReadOnlyMaterial({
  writingId,
  bp,
  hasCounterargument,
}: {
  writingId: string;
  bp: ParagraphFormBpData;
  hasCounterargument: boolean;
}) {
  const ts =
    bp.shaping?.final_topic_sentence?.trim() ||
    bp.working_topic_sentence?.trim() ||
    "";
  const tsIsDraft =
    !bp.shaping?.final_topic_sentence?.trim() &&
    !!bp.working_topic_sentence?.trim();

  const cs =
    bp.shaping?.final_concluding_sentence?.trim() ||
    bp.concluding_sentence?.trim() ||
    "";
  const csIsDraft =
    !bp.shaping?.final_concluding_sentence?.trim() &&
    !!bp.concluding_sentence?.trim();

  const hasAnyChunkContent = bp.chunks.some(
    (c) =>
      c.cd_sentences.some((s) => s.trim().length > 0) ||
      c.cm_sentences.some((s) => s.trim().length > 0)
  );

  return (
    <div className="space-y-3">
      <header>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-700">
          Your sentence material
        </div>
      </header>

      {/* Topic Sentence */}
      <Section title="Topic Sentence" accentClass="text-[color:var(--jswp-color-ts)]">
        {ts ? (
          <SentenceBlock text={ts} draft={tsIsDraft} />
        ) : (
          <BackLinkNotice writingId={writingId} message="No topic sentence yet." />
        )}
      </Section>

      {/* Per-chunk material */}
      {bp.chunks.length > 0 && (
        <>
          {!hasAnyChunkContent && (
            <BackLinkNotice
              writingId={writingId}
              message="No chunk sentences yet — finish shaping first."
            />
          )}
          {bp.chunks.map((chunk) => (
            <ChunkSection
              key={chunk.id}
              writingId={writingId}
              chunkPosition={chunk.position}
              cdSentences={chunk.cd_sentences}
              cmSentences={chunk.cm_sentences}
            />
          ))}
        </>
      )}

      {/* C/CA/R block (argumentation only with has_counterargument) */}
      {hasCounterargument && bp.shaping && (
        <Section
          title={
            <>
              <span className="jswp-concession text-[color:var(--jswp-color-concession)]">
                Concession
              </span>{" "}
              /{" "}
              <span className="jswp-counterargument text-[color:var(--jswp-color-counterargument)]">
                Counterargument
              </span>{" "}
              /{" "}
              <span className="jswp-refutation text-[color:var(--jswp-color-refutation)]">
                Refutation
              </span>
            </>
          }
          accentClass="text-gray-700"
        >
          <LabeledLine label="Concession" text={bp.shaping.final_concession} />
          <LabeledLine
            label="Counterargument"
            text={bp.shaping.final_counterargument}
          />
          <LabeledLine label="Refutation" text={bp.shaping.final_refutation} />
        </Section>
      )}

      {/* Concluding Sentence */}
      <Section title="Concluding Sentence" accentClass="text-[color:var(--jswp-color-cs)]">
        {cs ? (
          <SentenceBlock text={cs} draft={csIsDraft} />
        ) : (
          <BackLinkNotice
            writingId={writingId}
            message="No concluding sentence yet."
          />
        )}
      </Section>
    </div>
  );
}

function ChunkSection({
  writingId,
  chunkPosition,
  cdSentences,
  cmSentences,
}: {
  writingId: string;
  chunkPosition: number;
  cdSentences: readonly string[];
  cmSentences: readonly string[];
}) {
  const cds = cdSentences.filter((s) => s.trim().length > 0);
  const cms = cmSentences.filter((s) => s.trim().length > 0);
  const isEmpty = cds.length === 0 && cms.length === 0;

  return (
    <Section title={`Chunk ${chunkPosition}`} accentClass="text-gray-700">
      {isEmpty ? (
        <BackLinkNotice
          writingId={writingId}
          message="No sentences yet — finish shaping first."
        />
      ) : (
        <>
          {cds.length > 0 && (
            <SentenceList
              label="CD sentences"
              accentClass="text-[color:var(--jswp-color-cd)]"
              sentences={cds}
            />
          )}
          {cms.length > 0 && (
            <SentenceList
              label="CM sentences"
              accentClass="text-[color:var(--jswp-color-cm)]"
              sentences={cms}
            />
          )}
        </>
      )}
    </Section>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function Section({
  title,
  accentClass,
  children,
}: {
  title: React.ReactNode;
  accentClass: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <div className={`text-base font-semibold uppercase tracking-wide ${accentClass}`}>
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function SentenceBlock({ text, draft }: { text: string; draft: boolean }) {
  return (
    <div className="text-sm text-gray-900 whitespace-pre-wrap">
      {draft && (
        <span className="inline-flex items-center px-1.5 py-0.5 mr-1 rounded-full bg-amber-100 text-amber-700 text-base font-medium align-middle">
          draft
        </span>
      )}
      {text}
    </div>
  );
}

function LabeledLine({
  label,
  text,
}: {
  label: string;
  text: string | null;
}) {
  const t = text?.trim() ?? "";
  return (
    <div className="text-sm">
      <span className="text-xs uppercase tracking-wide text-gray-500 mr-1">
        {label}:
      </span>
      {t ? (
        <span className="text-gray-900 whitespace-pre-wrap">{t}</span>
      ) : (
        <span className="text-gray-500 italic">(empty)</span>
      )}
    </div>
  );
}

function SentenceList({
  label,
  accentClass,
  sentences,
}: {
  label: string;
  accentClass: string;
  sentences: readonly string[];
}) {
  return (
    <div>
      <div
        className={`text-base font-semibold uppercase tracking-wide ${accentClass}`}
      >
        {label}
      </div>
      <ul className="space-y-0.5 mt-0.5">
        {sentences.map((s, i) => (
          <li key={i} className="text-sm text-gray-900 whitespace-pre-wrap">
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BackLinkNotice({
  writingId,
  message,
}: {
  writingId: string;
  message: string;
}) {
  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs">
      <p className="text-amber-900">{message}</p>
      <Link
        href={`/student/writings/${writingId}/shaping-sheet`}
        className="mt-1 inline-flex items-center px-2 py-0.5 rounded-md border border-amber-300 bg-white text-base text-amber-900 hover:bg-amber-50"
      >
        ← Back to Shaping Sheet
      </Link>
    </div>
  );
}
