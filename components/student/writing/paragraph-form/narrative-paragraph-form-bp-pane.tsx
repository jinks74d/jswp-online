"use client";

/**
 * One body paragraph's paragraph-form pane for narrative mode.
 *
 * Same desktop two-column / mobile stacked layout as the CD/CM pane,
 * but the read-only material differs: no chunks, no C/CA/R, no
 * cd_sentences/cm_sentences. Instead:
 *   - Topic Sentence (final or working draft)
 *   - From your discovery: key_word + concrete_example
 *   - WOW notes: when/where/who/what_happened/dialogue/feeling/thinking
 *     (only fields with content; empty ones omitted entirely)
 *   - Concluding Sentence (final or working draft)
 *
 * Editor is identical to the CD/CM pane's: live word count, onBlur
 * autosave, status indicator. Inlined since AutoSaveInput doesn't
 * expose onChange for live counting.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { updateFinalText } from "@/lib/actions/paragraph-form";
import { useWritingMode } from "../use-writing-mode";
import type { ParagraphFormBpData } from "@/lib/queries/paragraph-form";

export function NarrativeParagraphFormBpPane({
  writingId,
  bp,
}: {
  writingId: string;
  bp: ParagraphFormBpData;
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
          <ReadOnlyMaterial writingId={writingId} bp={bp} />
        </div>
      </details>

      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
          <ReadOnlyMaterial writingId={writingId} bp={bp} />
        </aside>

        <Editor
          writingId={writingId}
          paragraphFormId={pf.id}
          initialValue={pf.final_text}
        />
      </div>
    </>
  );
}

/* ─── Editor (same shape as CD/CM pane's, duplicated for clarity) ── */

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
        Compose the polished narrative paragraph using your discovery and
        WOW notes as a guide.
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
          placeholder="Write the polished narrative paragraph here…"
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
      <div className="text-xs text-gray-500">Word count: {wordCount}</div>
    </div>
  );
}

function countWords(text: string): number {
  const t = text.trim();
  if (t.length === 0) return 0;
  return t.split(/\s+/).length;
}

/* ─── Read-only material for narrative ────────────────────────────── */

function ReadOnlyMaterial({
  writingId,
  bp,
}: {
  writingId: string;
  bp: ParagraphFormBpData;
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

  const keyWord = bp.narrative_key_word?.trim() ?? "";
  const concreteExample = bp.narrative_concrete_example?.trim() ?? "";
  const hasDiscovery = keyWord.length > 0 || concreteExample.length > 0;

  const wowFields: Array<[string, string | null]> = [
    ["When", bp.narrative_when],
    ["Where", bp.narrative_where],
    ["Who", bp.narrative_who],
    ["What happened", bp.narrative_what_happened],
    ["Dialogue", bp.narrative_dialogue],
    ["Feeling", bp.narrative_feeling],
    ["Thinking", bp.narrative_thinking],
  ];
  const wowFilled = wowFields.filter(
    ([, v]) => v !== null && v !== undefined && v.trim().length > 0
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
          <BackLinkNotice
            writingId={writingId}
            message="No topic sentence yet."
          />
        )}
      </Section>

      {/* Discovery context */}
      {hasDiscovery && (
        <Section title="From your discovery" accentClass="text-amber-700">
          {keyWord && (
            <div className="text-sm">
              <span className="text-xs uppercase tracking-wide text-gray-500 mr-1">
                Key word:
              </span>
              <span className="font-semibold text-gray-900">{keyWord}</span>
            </div>
          )}
          {concreteExample && (
            <div className="text-sm text-gray-900 whitespace-pre-wrap">
              {concreteExample}
            </div>
          )}
        </Section>
      )}

      {/* WOW notes (only if any field is filled) */}
      {wowFilled.length > 0 && (
        <Section title="WOW notes" accentClass="text-gray-700">
          <dl className="space-y-1">
            {wowFilled.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  {label}
                </dt>
                <dd className="text-sm text-gray-900 whitespace-pre-wrap">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
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

/* ─── Helpers (subset, matching CD/CM pane) ───────────────────────── */

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
      <div
        className={`text-[11px] font-semibold uppercase tracking-wide ${accentClass}`}
      >
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
