"use client";

/**
 * Source text editing block: metadata (title / author / citation / URL) plus a
 * mode-aware body. The render mode follows the uploaded file type:
 *   - plain → textarea (today's behavior; posts source_text)
 *   - rich  → contentEditable editor (posts source_html; server derives the
 *             source_text substrate)
 *   - pdf   → the uploaded PDF is the source; body is "Open original" + a
 *             read-only extracted-text preview (extracted text posts as the
 *             hidden source_text substrate)
 *
 * Hidden inputs carry source_html / source_render_mode / source_file_* to the
 * server action. See docs/SOURCE_TEXT_ARCHITECTURE.md.
 *
 * Visible only for modes that respond to a text (Expository, Argumentation,
 * Literary). Narrative renders nothing here.
 */

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ExternalLink, FileText } from "lucide-react";
import type { Database } from "@/lib/database.types";
import { SourceTextUpload, type ExtractedSource } from "./source-text-upload";
import { RichSourceEditor } from "./rich-source-editor";
import { getAssignmentSourceSignedUrl } from "@/lib/storage/assignment-sources";

type RenderMode = "pdf" | "rich" | "plain";

export type SourceTextInitial = {
  source_text: string | null;
  source_title: string | null;
  source_author: string | null;
  source_citation: string | null;
  source_url: string | null;
  source_html: string | null;
  source_render_mode: RenderMode | null;
  source_file_path: string | null;
  source_file_name: string | null;
  source_file_mime: string | null;
};

type StoredFile = { path: string; name: string; mime: string };

export function SourceTextFields({
  initial,
  disabled,
  schoolId,
  assignmentId,
  supabase,
}: {
  initial?: SourceTextInitial;
  disabled?: boolean;
  schoolId: string;
  assignmentId?: string;
  supabase: SupabaseClient<Database>;
}) {
  const [mode, setMode] = useState<RenderMode>(
    initial?.source_render_mode ?? (initial?.source_html ? "rich" : "plain")
  );
  const [body, setBody] = useState<string>(initial?.source_text ?? "");
  const [html, setHtml] = useState<string>(initial?.source_html ?? "");
  const [file, setFile] = useState<StoredFile | null>(
    initial?.source_file_path
      ? {
          path: initial.source_file_path,
          name: initial.source_file_name ?? "source file",
          mime: initial.source_file_mime ?? "",
        }
      : null
  );
  const [openError, setOpenError] = useState<string | null>(null);

  function onExtracted(s: ExtractedSource) {
    setMode(s.renderMode);
    if (s.renderMode === "rich") setHtml(s.html ?? "");
    else setBody(s.text);
    if (s.file) setFile(s.file);
  }

  async function openOriginal() {
    if (!file) return;
    setOpenError(null);
    const res = await getAssignmentSourceSignedUrl(supabase, file.path);
    if (res.ok) window.open(res.url, "_blank", "noopener,noreferrer");
    else setOpenError(res.error);
  }

  return (
    <fieldset className="space-y-4 bg-white border border-gray-200 rounded-lg p-5">
      <legend className="text-sm font-semibold text-gray-700 px-1">
        Source text
      </legend>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Title" htmlFor="source_title">
          <input
            id="source_title"
            name="source_title"
            type="text"
            defaultValue={initial?.source_title ?? ""}
            disabled={disabled}
            placeholder="e.g. The Secret to Raising Smart Kids"
            className={inputClass}
          />
        </Field>
        <Field label="Author" htmlFor="source_author">
          <input
            id="source_author"
            name="source_author"
            type="text"
            defaultValue={initial?.source_author ?? ""}
            disabled={disabled}
            placeholder="e.g. Carol S. Dweck"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Citation (MLA / APA / Chicago)" htmlFor="source_citation">
        <input
          id="source_citation"
          name="source_citation"
          type="text"
          defaultValue={initial?.source_citation ?? ""}
          disabled={disabled}
          placeholder="e.g. Dweck, Carol S. Scientific American Mind, Nov. 2007."
          className={inputClass}
        />
        <p className="mt-1 text-xs text-gray-500">
          You can include the publication and any reproduction-permission note
          here.
        </p>
      </Field>

      <Field label="Source URL (optional)" htmlFor="source_url">
        <input
          id="source_url"
          name="source_url"
          type="url"
          defaultValue={initial?.source_url ?? ""}
          disabled={disabled}
          placeholder="https://…"
          className={inputClass}
        />
      </Field>

      {!disabled && (
        <SourceTextUpload
          assignmentId={assignmentId}
          schoolId={schoolId}
          supabase={supabase}
          onExtracted={onExtracted}
        />
      )}

      {file && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
          <span className="inline-flex min-w-0 items-center gap-2 text-sm text-gray-700">
            <FileText className="h-4 w-4 flex-shrink-0 text-gray-500" />
            <span className="truncate">{file.name}</span>
          </span>
          <button
            type="button"
            onClick={openOriginal}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open original
          </button>
        </div>
      )}
      {openError && <p className="text-sm text-red-600">{openError}</p>}

      {mode === "pdf" ? (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <p className="font-medium">PDF source</p>
          <p className="mt-1 text-blue-800">
            Students read and annotate the PDF directly. Use “Open original” to
            review it. The text below is extracted for reference and powers
            annotation.
          </p>
          {body && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-blue-700">
                Extracted text preview ({body.length.toLocaleString()} chars)
              </summary>
              <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-gray-700">
                {body}
              </pre>
            </details>
          )}
        </div>
      ) : (
        <Field label="Source body" htmlFor="source_text">
          {!disabled && (
            <div className="mb-2 inline-flex overflow-hidden rounded-md border border-gray-300 text-xs">
              <ModeTab
                active={mode === "plain"}
                onClick={() => setMode("plain")}
              >
                Plain
              </ModeTab>
              <ModeTab
                active={mode === "rich"}
                onClick={() => setMode("rich")}
              >
                Rich text
              </ModeTab>
            </div>
          )}

          {mode === "rich" ? (
            <RichSourceEditor
              value={html}
              onChange={setHtml}
              disabled={disabled}
            />
          ) : (
            <>
              <p className="mb-1.5 text-xs text-gray-500">
                Separate each paragraph with a blank line. If the article
                numbers its paragraphs, keep those numbers — students cite
                concrete details by paragraph.
              </p>
              <textarea
                id="source_text"
                name="source_text"
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={disabled}
                placeholder="Paste the source text here, or upload a PDF / .docx / .txt file above."
                className={`${inputClass} font-mono text-xs leading-relaxed`}
              />
              <p className="mt-1 text-xs text-gray-500">
                {body.length.toLocaleString()} character
                {body.length === 1 ? "" : "s"}
              </p>
            </>
          )}
        </Field>
      )}

      {/* Resolved payload → server action. Plain mode posts source_text via the
          textarea above; pdf posts the extracted substrate here; rich posts
          source_html and the server derives source_text. */}
      <input type="hidden" name="source_render_mode" value={mode} />
      <input
        type="hidden"
        name="source_html"
        value={mode === "rich" ? html : ""}
      />
      {mode === "pdf" && (
        <input type="hidden" name="source_text" value={body} />
      )}
      <input
        type="hidden"
        name="source_file_path"
        value={file?.path ?? ""}
      />
      <input
        type="hidden"
        name="source_file_name"
        value={file?.name ?? ""}
      />
      <input
        type="hidden"
        name="source_file_mime"
        value={file?.mime ?? ""}
      />
    </fieldset>
  );
}

const inputClass =
  "w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-700";

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1 font-medium ${
        active
          ? "bg-blue-600 text-white"
          : "bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-gray-700 mb-1.5"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
