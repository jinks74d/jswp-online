"use client";

/**
 * Minimal contentEditable rich-text editor for the source body (Chunk 1 of
 * the structured-source work). Deliberately tiny — headings, bold, italic,
 * underline, and lists — no new dependency. Output HTML is re-sanitized
 * server-side by sanitizeSourceHtml, so messy execCommand markup is cleaned
 * before storage, and source_text is derived from the sanitized result.
 *
 * contentEditable + React: we seed the DOM from `value` only when it changes
 * from outside (e.g. a .docx import) and the editor isn't focused, to avoid
 * clobbering the caret while typing.
 */

import { useEffect, useRef } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading2,
  Heading3,
  List,
  ListOrdered,
} from "lucide-react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}

export function RichSourceEditor({ value, onChange, disabled }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el !== document.activeElement && el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value]);

  function exec(command: string, arg?: string) {
    if (disabled) return;
    // execCommand is deprecated but remains the simplest cross-browser way to
    // format a contentEditable region; output is sanitized server-side.
    document.execCommand(command, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  }

  const tool =
    "p-1.5 rounded hover:bg-gray-200 text-gray-700 disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className="border border-gray-300 rounded-md overflow-hidden">
      {!disabled && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-1.5 py-1">
          <ToolButton label="Heading" onClick={() => exec("formatBlock", "h2")}>
            <Heading2 className="w-4 h-4" />
          </ToolButton>
          <ToolButton
            label="Subheading"
            onClick={() => exec("formatBlock", "h3")}
          >
            <Heading3 className="w-4 h-4" />
          </ToolButton>
          <ToolButton label="Paragraph" onClick={() => exec("formatBlock", "p")}>
            <span className="text-xs font-medium px-1">¶</span>
          </ToolButton>
          <Divider />
          <ToolButton label="Bold" onClick={() => exec("bold")}>
            <Bold className="w-4 h-4" />
          </ToolButton>
          <ToolButton label="Italic" onClick={() => exec("italic")}>
            <Italic className="w-4 h-4" />
          </ToolButton>
          <ToolButton label="Underline" onClick={() => exec("underline")}>
            <UnderlineIcon className="w-4 h-4" />
          </ToolButton>
          <Divider />
          <ToolButton
            label="Bulleted list"
            onClick={() => exec("insertUnorderedList")}
          >
            <List className="w-4 h-4" />
          </ToolButton>
          <ToolButton
            label="Numbered list"
            onClick={() => exec("insertOrderedList")}
          >
            <ListOrdered className="w-4 h-4" />
          </ToolButton>
        </div>
      )}
      <div
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={() => ref.current && onChange(ref.current.innerHTML)}
        role="textbox"
        aria-multiline="true"
        aria-label="Source body"
        className="min-h-[12rem] max-h-[28rem] overflow-y-auto px-3 py-2 text-sm leading-relaxed text-gray-900 focus:outline-none disabled:bg-gray-50 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-2 [&_h3]:text-base [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5"
      />
    </div>
  );

  function ToolButton({
    label,
    onClick,
    children,
  }: {
    label: string;
    onClick: () => void;
    children: React.ReactNode;
  }) {
    return (
      <button
        type="button"
        title={label}
        aria-label={label}
        disabled={disabled}
        // preventDefault keeps the text selection inside the editor when the
        // toolbar button takes focus.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={tool}
      >
        {children}
      </button>
    );
  }
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-gray-300" aria-hidden />;
}
