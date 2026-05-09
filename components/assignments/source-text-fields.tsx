"use client";

/**
 * Source text editing block: title / author / citation / URL + body
 * textarea. The body textarea is controlled so the upload component
 * can populate it after parsing a file.
 *
 * Visible only for modes that respond to a text (Expository,
 * Argumentation, Literary). Narrative renders nothing here.
 */

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { SourceTextUpload } from "./source-text-upload";

export type SourceTextInitial = {
  source_text: string | null;
  source_title: string | null;
  source_author: string | null;
  source_citation: string | null;
  source_url: string | null;
};

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
  const [body, setBody] = useState<string>(initial?.source_text ?? "");

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
            placeholder="e.g. Annabel Lee"
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
            placeholder="e.g. Edgar Allan Poe"
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
          placeholder="e.g. Poe, Edgar Allan. &quot;Annabel Lee.&quot; 1849."
          className={inputClass}
        />
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
          onTextExtracted={(text) => setBody(text)}
        />
      )}

      <Field label="Source body" htmlFor="source_text">
        <textarea
          id="source_text"
          name="source_text"
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={disabled}
          placeholder="Paste the source text here, or upload a PDF / .txt file above to populate."
          className={`${inputClass} font-mono text-xs leading-relaxed`}
        />
        <p className="mt-1 text-xs text-gray-500">
          {body.length.toLocaleString()} character
          {body.length === 1 ? "" : "s"}
        </p>
      </Field>
    </fieldset>
  );
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-700";

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
