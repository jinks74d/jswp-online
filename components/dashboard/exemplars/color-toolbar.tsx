"use client";

/**
 * Color-marking toolbar for the exemplar form (chunk 6.6b).
 *
 * Reads the current selection from the wired textarea, wraps the
 * selected text in a `<span class="jswp-…">` wrapper, and writes
 * the new value back through the onChange prop. Replaces 6.6a's
 * raw-HTML textarea fallback.
 *
 * Behavior:
 *   - Buttons enabled iff there's a non-empty selection.
 *   - "Mark as X" replaces any jswp-* span fully contained in the
 *     selection (no nested marks). Spans that span the selection
 *     boundary are left intact and the sanitizer's class walker
 *     handles edge cases on save (v1 known limitation).
 *   - Mode-aware: non-Argumentation modes hide the three
 *     argumentation-only classes (concession, counterargument,
 *     refutation).
 *   - Native textarea undo (Ctrl+Z) doesn't restore toolbar-
 *     applied marks — React's programmatic value updates aren't
 *     in the browser's undo stack. v1 limitation; document.
 */

import { useEffect, useState } from "react";
import {
  JSWP_CONTENT_CLASSES,
  JSWP_CONTENT_LABELS,
  type JswpContentClass,
} from "@/lib/exemplar-content-shared";
import type { RefObject } from "react";

type Mode = "expository" | "argumentation" | "literary" | "narrative";

/** Mirrors the ::before symbol in app/globals.css. Used inline on
 * the toolbar buttons so teachers see the same glyph that prefixes
 * marked content in the rendered preview. */
const SYMBOL_BY_CLASS: Record<JswpContentClass, string> = {
  "jswp-ts": "●",
  "jswp-cs": "●",
  "jswp-cd": "▲",
  "jswp-cm": "■",
  "jswp-thesis": "◆",
  "jswp-intro": "§",
  "jswp-conclusion": "¶",
  "jswp-concession": "◐",
  "jswp-counterargument": "◑",
  "jswp-refutation": "✕",
};

/** CSS variable name (per app/globals.css) for the role's color.
 * Applied inline on the button symbol so it visually matches the
 * marked content without also triggering the ::before glyph from
 * the role's class. */
const COLOR_VAR_BY_CLASS: Record<JswpContentClass, string> = {
  "jswp-ts": "var(--jswp-color-ts)",
  "jswp-cs": "var(--jswp-color-cs)",
  "jswp-cd": "var(--jswp-color-cd)",
  "jswp-cm": "var(--jswp-color-cm)",
  "jswp-thesis": "var(--jswp-color-thesis-fg)",
  "jswp-intro": "var(--jswp-color-intro)",
  "jswp-conclusion": "var(--jswp-color-conclusion)",
  "jswp-concession": "var(--jswp-color-concession)",
  "jswp-counterargument": "var(--jswp-color-counterargument)",
  "jswp-refutation": "var(--jswp-color-refutation)",
};

const ARGUMENTATION_ONLY: ReadonlySet<JswpContentClass> = new Set([
  "jswp-concession",
  "jswp-counterargument",
  "jswp-refutation",
]);

interface Props {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  mode: Mode;
}

export function ColorToolbar({ textareaRef, value, onChange, mode }: Props) {
  const [hasSelection, setHasSelection] = useState(false);

  // Track non-empty selection for button enable/disable.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    const update = () => {
      setHasSelection(ta.selectionStart !== ta.selectionEnd);
    };
    ta.addEventListener("select", update);
    ta.addEventListener("mouseup", update);
    ta.addEventListener("keyup", update);
    update(); // initial state
    return () => {
      ta.removeEventListener("select", update);
      ta.removeEventListener("mouseup", update);
      ta.removeEventListener("keyup", update);
    };
  }, [textareaRef]);

  const visibleClasses = JSWP_CONTENT_CLASSES.filter((c) => {
    if (mode === "argumentation") return true;
    return !ARGUMENTATION_ONLY.has(c);
  });

  const applyMark = (cls: JswpContentClass) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) return;

    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);

    // Strip any jswp-* spans fully contained in the selection so
    // re-marking replaces rather than nests. Spans that span the
    // selection boundary aren't matched by this regex and will
    // surface to the sanitizer on save (where the class walker
    // unwraps nested jswp-* spans).
    const cleanSelected = selected.replace(
      /<span\s+class="jswp-[\w-]+">([^<]*)<\/span>/g,
      "$1"
    );

    const opener = `<span class="${cls}">`;
    const closer = `</span>`;
    const wrapped = `${opener}${cleanSelected}${closer}`;
    const next = `${before}${wrapped}${after}`;
    onChange(next);

    // Re-focus + restore selection over the new span's content
    // after React commits the value change.
    requestAnimationFrame(() => {
      ta.focus();
      const contentStart = before.length + opener.length;
      const contentEnd = contentStart + cleanSelected.length;
      ta.setSelectionRange(contentStart, contentEnd);
      setHasSelection(contentStart !== contentEnd);
    });
  };

  return (
    <div
      role="toolbar"
      aria-label="Color-code marks"
      className="flex flex-wrap gap-1.5 mb-2 pb-2 border-b border-gray-200"
    >
      {visibleClasses.map((cls) => {
        const label = JSWP_CONTENT_LABELS[cls];
        const symbol = SYMBOL_BY_CLASS[cls];
        return (
          <button
            key={cls}
            type="button"
            onClick={() => applyMark(cls)}
            disabled={!hasSelection}
            title={
              !hasSelection
                ? "Select text first"
                : `Mark selection as ${label}`
            }
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span
              aria-hidden
              style={{ color: COLOR_VAR_BY_CLASS[cls] }}
              className="font-bold"
            >
              {symbol}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
