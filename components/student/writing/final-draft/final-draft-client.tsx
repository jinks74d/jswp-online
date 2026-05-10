"use client";

/**
 * Final-draft step UI.
 *
 * Layout (single screen):
 *   - Title input (optional; not gated)
 *   - Assembly source panel (<details open>) — read-only preview of
 *     intro + paragraphs + conclusion. Each piece labeled with a
 *     back-link to its source step. Empty pieces show
 *     "(introduction not written yet)" / "(BP N not written yet)" /
 *     "(conclusion not written yet)" with the same back-link.
 *   - [Assemble from pieces] button — calls assembleFinalDraft.
 *     If full_text is non-empty, native confirm() warns about
 *     overwrite before proceeding. Otherwise writes directly.
 *   - full_text textarea — inline editor with live word count
 *     (matching chunk 4.6b's pattern; consolidation is a Phase 7
 *     backlog item).
 *
 * Continue gate: full_text non-empty trimmed. Title is optional.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Wand2 } from "lucide-react";
import { AutoSaveInput } from "../t-chart/auto-save-input";
import {
  assembleFinalDraft,
  updateFullText,
  updateTitle,
} from "@/lib/actions/final-draft";
import { completeStepAndAdvance } from "@/lib/actions/student-writings";
import type {
  AssemblySource,
  FinalDraftRowData,
} from "@/lib/queries/final-draft";

interface Props {
  writingId: string;
  stepKey: string;
  finalDraft: FinalDraftRowData | null;
  assembly: AssemblySource;
}

export function FinalDraftClient({
  writingId,
  stepKey,
  finalDraft,
  assembly,
}: Props) {
  if (!finalDraft) {
    return (
      <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
        Final draft row not yet bootstrapped. Reload to retry.
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <TitleField
        writingId={writingId}
        finalDraftId={finalDraft.id}
        initialTitle={finalDraft.title ?? ""}
      />

      <AssemblyPanel writingId={writingId} assembly={assembly} />

      <AssembleButton
        writingId={writingId}
        finalDraftId={finalDraft.id}
        currentFullText={finalDraft.full_text}
      />

      <FullTextEditor
        writingId={writingId}
        finalDraftId={finalDraft.id}
        initialValue={finalDraft.full_text}
      />

      <ContinueBar
        writingId={writingId}
        stepKey={stepKey}
        currentFullText={finalDraft.full_text}
      />
    </div>
  );
}

/* ─── Title field (autosave, not gated) ───────────────────────────── */

function TitleField({
  writingId,
  finalDraftId,
  initialTitle,
}: {
  writingId: string;
  finalDraftId: string;
  initialTitle: string;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-gray-900">
        Title <span className="text-xs text-gray-500">(optional)</span>
      </div>
      <p className="text-xs text-gray-500 mt-0.5">
        A creative title — often a word or phrase pulled from your draft.
      </p>
      <div className="mt-1.5">
        <AutoSaveInput
          initialValue={initialTitle}
          placeholder="Untitled"
          onSave={async (next) => {
            await updateTitle(writingId, finalDraftId, next);
          }}
        />
      </div>
    </div>
  );
}

/* ─── Assembly source panel (<details open> by default) ───────────── */

function AssemblyPanel({
  writingId,
  assembly,
}: {
  writingId: string;
  assembly: AssemblySource;
}) {
  return (
    <details
      open
      className="bg-white border border-gray-200 rounded-lg group"
    >
      <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">
          Assembly source
        </span>
        <span className="text-xs text-gray-500 group-open:hidden">Show</span>
        <span className="text-xs text-gray-500 hidden group-open:inline">
          Hide
        </span>
      </summary>
      <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
        <SourceSection
          label="Introduction"
          accentClass="text-blue-700"
          text={assembly.introduction_text}
          emptyMessage="(introduction not written yet)"
          backLink={{ href: `/student/writings/${writingId}/introduction`, label: "Back to Introduction" }}
        />
        {assembly.paragraphs.map((p) => (
          <SourceSection
            key={p.bp_id}
            label={`Body paragraph ${p.bp_position}`}
            accentClass="text-gray-700"
            text={p.final_text}
            emptyMessage={`(BP ${p.bp_position} not written yet)`}
            backLink={{
              href: `/student/writings/${writingId}/paragraph-form`,
              label: "Back to Paragraph Form",
            }}
          />
        ))}
        <SourceSection
          label="Conclusion"
          accentClass="text-blue-700"
          text={assembly.conclusion_text}
          emptyMessage="(conclusion not written yet)"
          backLink={{ href: `/student/writings/${writingId}/conclusion`, label: "Back to Conclusion" }}
        />
      </div>
    </details>
  );
}

function SourceSection({
  label,
  accentClass,
  text,
  emptyMessage,
  backLink,
}: {
  label: string;
  accentClass: string;
  text: string;
  emptyMessage: string;
  backLink: { href: string; label: string };
}) {
  const trimmed = text.trim();
  const isEmpty = trimmed.length === 0;

  return (
    <section className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div
          className={`text-[11px] font-semibold uppercase tracking-wide ${accentClass}`}
        >
          {label}
        </div>
        <Link
          href={backLink.href}
          className="text-[11px] text-gray-500 hover:text-gray-900 underline-offset-2 hover:underline"
        >
          ← {backLink.label}
        </Link>
      </div>
      {isEmpty ? (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs text-amber-900">
          {emptyMessage}
        </div>
      ) : (
        <p className="text-sm text-gray-900 whitespace-pre-wrap">{trimmed}</p>
      )}
    </section>
  );
}

/* ─── Assemble button ─────────────────────────────────────────────── */

function AssembleButton({
  writingId,
  finalDraftId,
  currentFullText,
}: {
  writingId: string;
  finalDraftId: string;
  currentFullText: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    if (currentFullText.trim().length > 0) {
      const ok = window.confirm(
        "Replace your current full draft? Your edits will be lost."
      );
      if (!ok) return;
    }
    start(async () => {
      try {
        await assembleFinalDraft(writingId, finalDraftId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Assemble failed.");
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Wand2 className="w-4 h-4" />
        )}
        Assemble from pieces
      </button>
      {error && (
        <span className="text-sm text-red-700" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/* ─── full_text editor (inline; live word count) ──────────────────── */

function FullTextEditor({
  writingId,
  finalDraftId,
  initialValue,
}: {
  writingId: string;
  finalDraftId: string;
  initialValue: string;
}) {
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
      await updateFullText(writingId, finalDraftId, value);
      lastSavedRef.current = value;
      setStatus("saved");
      setTimeout(
        () => setStatus((s) => (s === "saved" ? "idle" : s)),
        1500
      );
    } catch (e) {
      console.error("final-draft save:", e);
      setStatus("error");
    }
  };

  const wordCount = countWords(value);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-900">Full draft</div>
      <p className="text-xs text-gray-500">
        Compose or refine the assembled essay. Re-assemble any time to
        pull in fresh upstream changes.
      </p>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={handleBlur}
          rows={18}
          placeholder="Your assembled essay will appear here…"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

/* ─── Continue bar ────────────────────────────────────────────────── */

function ContinueBar({
  writingId,
  stepKey,
  currentFullText,
}: {
  writingId: string;
  stepKey: string;
  currentFullText: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canContinue = currentFullText.trim().length > 0;

  const onContinue = () => {
    setError(null);
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
    <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200">
      <div className="text-xs text-gray-500">
        {canContinue
          ? "Final draft ready."
          : "Write or assemble your full draft to continue."}
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
          disabled={!canContinue || pending}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: "var(--district-primary)" }}
        >
          {pending && <Loader2 className="w-4 h-4 animate-spin" />}
          {pending ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
