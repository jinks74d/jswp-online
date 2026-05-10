"use client";

/**
 * One body paragraph's paragraph-form pane for expository /
 * argumentation / literary modes.
 *
 * Layout:
 *   Desktop (lg+): two-column grid.
 *     Left  (18rem): read-only sentence material from shaping.
 *     Right (1fr):   editable final_text textarea + live word count.
 *   Mobile: read-only material in a <details> at top, textarea below.
 *
 * Read-only material structure:
 *   - Topic Sentence  (final_topic_sentence, falling back to working_topic_sentence
 *                      with a "draft" pill if final is empty)
 *   - Per chunk: CD sentences + CM sentences (color-tinted headers)
 *   - Conditional Concession / Counterargument / Refutation block
 *     (when has_counterargument)
 *   - Concluding Sentence (final_concluding_sentence, falling back)
 *
 * Empty sections (a chunk without any cd_sentences/cm_sentences) get
 * a friendly "no sentences yet — finish shaping first" notice with a
 * back-link. Doesn't gate.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { updateFinalText } from "@/lib/actions/paragraph-form";
import { useWritingMode } from "../use-writing-mode";
import type { ParagraphFormBpData } from "@/lib/queries/paragraph-form";

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
    return (
      <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
        Paragraph-form row not yet bootstrapped. Reload to retry.
      </div>
    );
  }

  return (
    <>
      {/* Mobile: read-only as collapsible at top */}
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

      {/* Desktop two-column / mobile single-column for the editor */}
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
          <ReadOnlyMaterial
            writingId={writingId}
            bp={bp}
            hasCounterargument={hasCounterargument}
          />
        </aside>

        <Editor writingId={writingId} paragraphFormId={pf.id} initialValue={pf.final_text} />
      </div>
    </>
  );
}

/* ─── Editor (right column on desktop) ────────────────────────────── */

/**
 * Inline editor with live word count + onBlur autosave + save-status
 * indicator. AutoSaveInput would have worked except its onChange is
 * private — we need live word count as the student types, so this
 * component owns its own state.
 */
function Editor({
  writingId,
  paragraphFormId,
  initialValue,
}: {
  writingId: string;
  paragraphFormId: string;
  initialValue: string;
}) {
  const { isReadOnly } = useWritingMode();
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const isFocusedRef = useRef(false);
  const lastSavedRef = useRef(initialValue);

  // Pick up server-side prop refresh (e.g., after revalidate from a
  // sibling action) when the user isn't actively editing.
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
      setTimeout(
        () => setStatus((s) => (s === "saved" ? "idle" : s)),
        1500
      );
    } catch (e) {
      console.error("paragraph-form save:", e);
      setStatus("error");
    }
  };

  const wordCount = countWords(value);

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-700">
        Your paragraph
      </div>
      <p className="text-xs text-gray-500">
        Compose the polished paragraph from your sentence material. Use
        the side panel as your reference.
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
          rows={14}
          placeholder="Write the polished paragraph here…"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
        />
        <span
          className="absolute right-2 top-2 text-xs text-gray-500 pointer-events-none"
          aria-live="polite"
        >
          {status === "saving" && "Saving…"}
          {status === "saved" && (
            <span className="text-green-600">Saved</span>
          )}
          {status === "error" && (
            <span className="text-red-600">Retry?</span>
          )}
        </span>
      </div>
      <div className="text-xs text-gray-500">
        Word count: {wordCount}
      </div>
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
    !bp.shaping?.final_topic_sentence?.trim() && !!bp.working_topic_sentence?.trim();

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
      <Section title="Topic Sentence" accentClass="text-blue-700">
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
          title="Concession / Counterargument / Refutation"
          accentClass="text-purple-700"
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
      <Section title="Concluding Sentence" accentClass="text-blue-700">
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
              accentClass="text-red-700"
              sentences={cds}
            />
          )}
          {cms.length > 0 && (
            <SentenceList
              label="CM sentences"
              accentClass="text-green-700"
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
  title: string;
  accentClass: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <div className={`text-[11px] font-semibold uppercase tracking-wide ${accentClass}`}>
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
        <span className="inline-flex items-center px-1.5 py-0.5 mr-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium align-middle">
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
        <span className="text-gray-400 italic">(empty)</span>
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
        className={`text-[10px] font-semibold uppercase tracking-wide ${accentClass}`}
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
        className="mt-1 inline-flex items-center px-2 py-0.5 rounded-md border border-amber-300 bg-white text-[11px] text-amber-900 hover:bg-amber-50"
      >
        ← Back to Shaping Sheet
      </Link>
    </div>
  );
}
