"use client";

/**
 * Multi-source editor: a repeater of source blocks. Each block is metadata
 * (title / author / citation / URL) plus a mode-aware body (plain textarea,
 * rich contentEditable, or an uploaded PDF). The whole list is serialized to a
 * single hidden `sources` JSON input (like `rubric`) that the assignment
 * server action parses; per-source offset substrates are still character-based
 * (see docs/SOURCE_TEXT_ARCHITECTURE.md), now scoped per source.
 *
 * Visible only for modes that respond to a text (Expository, Argumentation,
 * Literary). Narrative renders nothing here.
 */

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ExternalLink, FileText, Plus, Trash2 } from "lucide-react";
import type { Database } from "@/lib/database.types";
import { SourceTextUpload, type ExtractedSource } from "./source-text-upload";
import { RichSourceEditor } from "./rich-source-editor";
import { getAssignmentSourceSignedUrl } from "@/lib/storage/assignment-sources";

type RenderMode = "pdf" | "rich" | "plain" | "image";
type SourceKind = "primary" | "secondary";

export type SourceInitial = {
  id: string;
  kind: SourceKind;
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

type SourceItem = {
  uid: string;
  /** assignment_sources.id when this row is already persisted; null when the
   *  teacher just added it in this session. After publish, rows with an id are
   *  frozen (their offsets anchor saved annotations) but new rows may be added. */
  id: string | null;
  kind: SourceKind;
  renderMode: RenderMode;
  title: string;
  author: string;
  citation: string;
  url: string;
  body: string; // substrate for plain/pdf modes
  html: string; // rich body
  file: StoredFile | null;
};

// Deterministic uid for the initial rows (index-based) so SSR and first client
// render agree — no crypto/random during render. New rows minted in handlers.
function fromInitial(s: SourceInitial, i: number): SourceItem {
  return {
    uid: `src-${i}`,
    id: s.id,
    kind: s.kind,
    renderMode: s.source_render_mode ?? (s.source_html ? "rich" : "plain"),
    title: s.source_title ?? "",
    author: s.source_author ?? "",
    citation: s.source_citation ?? "",
    url: s.source_url ?? "",
    body: s.source_text ?? "",
    html: s.source_html ?? "",
    file: s.source_file_path
      ? {
          path: s.source_file_path,
          name: s.source_file_name ?? "source file",
          mime: s.source_file_mime ?? "",
        }
      : null,
  };
}

function blankItem(uid: string): SourceItem {
  return {
    uid,
    id: null,
    kind: "primary",
    renderMode: "plain",
    title: "",
    author: "",
    citation: "",
    url: "",
    body: "",
    html: "",
    file: null,
  };
}

/** Serialize one item into the wire shape the server action expects. */
function toWire(it: SourceItem) {
  const isRich = it.renderMode === "rich";
  // An image source carries no body at all — the stored file is the source.
  if (it.renderMode === "image") {
    return {
      source_id: it.id ?? "",
      kind: it.kind,
      source_title: it.title,
      source_author: it.author,
      source_citation: it.citation,
      source_url: it.url,
      source_render_mode: "image" as const,
      source_html: "",
      source_text: "",
      source_file_path: it.file?.path ?? "",
      source_file_name: it.file?.name ?? "",
      source_file_mime: it.file?.mime ?? "",
    };
  }
  return {
    source_id: it.id ?? "",
    kind: it.kind,
    source_title: it.title,
    source_author: it.author,
    source_citation: it.citation,
    source_url: it.url,
    source_render_mode: it.renderMode,
    source_html: isRich ? it.html : "",
    source_text: isRich ? "" : it.body,
    source_file_path: it.file?.path ?? "",
    source_file_name: it.file?.name ?? "",
    source_file_mime: it.file?.mime ?? "",
  };
}

export function SourceTextFields({
  initial,
  published = false,
  schoolId,
  assignmentId,
  supabase,
  legend = "Source text",
  citationExample,
}: {
  initial?: SourceInitial[];
  /**
   * The assignment is published, so students may already have annotations
   * anchored to its saved sources. Those rows freeze; NEW sources can still be
   * added (the server appends them). Pre-publish everything stays editable.
   */
  published?: boolean;
  schoolId: string;
  assignmentId?: string;
  supabase: SupabaseClient<Database>;
  legend?: string;
  citationExample?: string;
}) {
  const [items, setItems] = useState<SourceItem[]>(() =>
    initial && initial.length > 0
      ? initial.map(fromInitial)
      : [blankItem("src-0")]
  );
  const [openError, setOpenError] = useState<string | null>(null);

  function patch(uid: string, next: Partial<SourceItem>) {
    setItems((prev) =>
      prev.map((it) => (it.uid === uid ? { ...it, ...next } : it))
    );
  }

  function addSource() {
    setItems((prev) => [...prev, blankItem(crypto.randomUUID())]);
  }

  function removeSource(uid: string) {
    setItems((prev) =>
      prev.length <= 1 ? prev : prev.filter((it) => it.uid !== uid)
    );
  }

  function onExtracted(uid: string, s: ExtractedSource) {
    patch(uid, {
      renderMode: s.renderMode,
      ...(s.renderMode === "rich"
        ? { html: s.html ?? "" }
        : { body: s.text }),
      ...(s.file ? { file: s.file } : {}),
    });
  }

  async function openOriginal(file: StoredFile) {
    setOpenError(null);
    const res = await getAssignmentSourceSignedUrl(supabase, file.path);
    if (res.ok) window.open(res.url, "_blank", "noopener,noreferrer");
    else setOpenError(res.error);
  }

  return (
    <fieldset className="space-y-4 bg-white border border-gray-200 rounded-lg p-5">
      <legend className="text-sm font-semibold text-gray-700 px-1">
        {legend}
      </legend>

      {published && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          This assignment is published. The sources students are already
          working from are locked — editing one would move every annotation
          they&apos;ve saved against it. You can still attach an additional
          source below.
        </p>
      )}

      {items.map((it, idx) => {
        // Locked = already persisted AND published. A source added in this
        // session (id === null) stays fully editable until it is saved.
        const locked = published && it.id !== null;
        return (
        <div
          key={it.uid}
          className="space-y-4 rounded-md border border-gray-200 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">
                Source {idx + 1}
              </span>
              {locked && (
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                  Locked
                </span>
              )}
              <select
                aria-label={`Source ${idx + 1} type`}
                value={it.kind}
                onChange={(e) =>
                  patch(it.uid, { kind: e.target.value as SourceKind })
                }
                disabled={locked}
                className="rounded-md border border-gray-500 px-2 py-1 text-xs text-gray-900 disabled:bg-gray-50"
              >
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
              </select>
            </div>
            {!locked && items.length > 1 && (
              <button
                type="button"
                onClick={() => removeSource(it.uid)}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Remove
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Title" htmlFor={`source_title_${it.uid}`}>
              <input
                id={`source_title_${it.uid}`}
                type="text"
                value={it.title}
                onChange={(e) => patch(it.uid, { title: e.target.value })}
                disabled={locked}
                placeholder="e.g., The Secret to Raising Smart Kids"
                className={inputClass}
              />
            </Field>
            <Field label="Author" htmlFor={`source_author_${it.uid}`}>
              <input
                id={`source_author_${it.uid}`}
                type="text"
                value={it.author}
                onChange={(e) => patch(it.uid, { author: e.target.value })}
                disabled={locked}
                placeholder="e.g., Carol S. Dweck"
                className={inputClass}
              />
            </Field>
          </div>

          <Field
            label="Citation (MLA / APA / Chicago)"
            htmlFor={`source_citation_${it.uid}`}
          >
            <input
              id={`source_citation_${it.uid}`}
              type="text"
              value={it.citation}
              onChange={(e) => patch(it.uid, { citation: e.target.value })}
              disabled={locked}
              placeholder="e.g., Dweck, Carol S. Scientific American Mind, Nov. 2007."
              className={inputClass}
            />
            {citationExample && (
              <p className="mt-1 text-xs text-gray-500">{citationExample}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              You can include the publication and any reproduction-permission
              note here.
            </p>
          </Field>

          <Field label="Source URL (optional)" htmlFor={`source_url_${it.uid}`}>
            <input
              id={`source_url_${it.uid}`}
              type="url"
              value={it.url}
              onChange={(e) => patch(it.uid, { url: e.target.value })}
              disabled={locked}
              placeholder="https://…"
              className={inputClass}
            />
          </Field>

          {!locked && (
            <SourceTextUpload
              assignmentId={assignmentId}
              schoolId={schoolId}
              supabase={supabase}
              onExtracted={(s) => onExtracted(it.uid, s)}
            />
          )}

          {it.file && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
              <span className="inline-flex min-w-0 items-center gap-2 text-sm text-gray-700">
                <FileText className="h-4 w-4 flex-shrink-0 text-gray-500" />
                <span className="truncate">{it.file.name}</span>
              </span>
              <button
                type="button"
                onClick={() => it.file && openOriginal(it.file)}
                className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open original
              </button>
            </div>
          )}

          {it.renderMode === "image" ? (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-medium">Image source</p>
              <p className="mt-1 text-blue-800">
                Students see this picture on the source and Read &amp; Annotate
                screens. An image has no text layer, so they can&apos;t
                highlight it — the annotate step won&apos;t require annotations
                for this source.
              </p>
              {it.file && (
                <ImageSourcePreview
                  supabase={supabase}
                  path={it.file.path}
                  name={it.file.name}
                />
              )}
            </div>
          ) : it.renderMode === "pdf" ? (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-medium">PDF source</p>
              <p className="mt-1 text-blue-800">
                Students read and annotate the PDF directly. Use “Open original”
                to review it. The text below is extracted for reference and
                powers annotation.
              </p>
              {it.body && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-blue-700">
                    Extracted text preview ({it.body.length.toLocaleString()}{" "}
                    chars)
                  </summary>
                  <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-gray-700">
                    {it.body}
                  </pre>
                </details>
              )}
            </div>
          ) : (
            <Field label="Source body" htmlFor={`source_text_${it.uid}`}>
              {!locked && (
                <div className="mb-2 inline-flex overflow-hidden rounded-md border border-gray-300 text-xs">
                  <ModeTab
                    active={it.renderMode === "plain"}
                    onClick={() => patch(it.uid, { renderMode: "plain" })}
                  >
                    Plain
                  </ModeTab>
                  <ModeTab
                    active={it.renderMode === "rich"}
                    onClick={() => patch(it.uid, { renderMode: "rich" })}
                  >
                    Rich text
                  </ModeTab>
                </div>
              )}

              {it.renderMode === "rich" ? (
                <RichSourceEditor
                  value={it.html}
                  onChange={(html) => patch(it.uid, { html })}
                  disabled={locked}
                />
              ) : (
                <>
                  <p className="mb-1.5 text-xs text-gray-500">
                    Separate each paragraph with a blank line. If the article
                    numbers its paragraphs, keep those numbers — students cite
                    concrete details by paragraph.
                  </p>
                  <textarea
                    id={`source_text_${it.uid}`}
                    rows={10}
                    value={it.body}
                    onChange={(e) => patch(it.uid, { body: e.target.value })}
                    disabled={locked}
                    placeholder="Paste the source text here, or upload a PDF / .docx / .txt file above."
                    className={`${inputClass} font-mono text-xs leading-relaxed`}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {it.body.length.toLocaleString()} character
                    {it.body.length === 1 ? "" : "s"}
                  </p>
                </>
              )}
            </Field>
          )}
        </div>
        );
      })}

      {openError && <p className="text-sm text-red-600">{openError}</p>}

      {/* Always available — adding a source is additive, so it stays open even
          after publish (the server appends; it never rewrites locked rows). */}
      <button
          type="button"
          onClick={addSource}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add another source
      </button>

      {/* Resolved payload → server action. The action re-sanitizes rich HTML and
          re-derives each source_text substrate; never trust posted HTML. */}
      <input
        type="hidden"
        name="sources"
        value={JSON.stringify(items.map(toWire))}
      />
    </fieldset>
  );
}

const inputClass =
  "w-full px-3 py-2 border border-gray-500 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-700";

/**
 * Thumbnail of an uploaded image source, so the teacher can confirm they
 * attached the right picture without opening a new tab. The bucket is private,
 * so the <img> src is a short-lived signed URL minted on mount (the same
 * 5-minute URL "Open original" uses). A failure here is silent — the preview is
 * a convenience, and "Open original" remains as the fallback.
 */
function ImageSourcePreview({
  supabase,
  path,
  name,
}: {
  supabase: SupabaseClient<Database>;
  path: string;
  name: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getAssignmentSourceSignedUrl(supabase, path).then((res) => {
      if (alive && res.ok) setUrl(res.url);
    });
    return () => {
      alive = false;
    };
  }, [supabase, path]);

  if (!url) return null;
  return (
    /* eslint-disable-next-line @next/next/no-img-element --
       next/image can't optimize a private, short-lived signed URL. */
    <img
      src={url}
      alt={`Preview of ${name}`}
      className="mt-2 max-h-64 w-auto rounded border border-blue-200 bg-white"
    />
  );
}

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
