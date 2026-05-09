"use client";

/**
 * Floating "[Annotate]" button anchored above the user's text selection.
 * Pure presentation — the parent owns the SelectionPayload state and
 * decides when this is mounted. Clicking the button calls onAnnotate;
 * clicking outside (or pressing Escape) calls onDismiss.
 */

import { useEffect, useRef } from "react";
import { Highlighter } from "lucide-react";

interface Props {
  /** Viewport-relative rect of the selection — used to position above. */
  rect: { top: number; left: number; right: number; bottom: number };
  onAnnotate: () => void;
  onDismiss: () => void;
}

const POPOVER_WIDTH = 132; // matches the px-3 + button content width

export function AnnotationPopover({ rect, onAnnotate, onDismiss }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onDismiss]);

  // Center the popover horizontally on the selection. Position it just
  // above; if there's no room above, drop it below the selection.
  const centerX = (rect.left + rect.right) / 2;
  const left = Math.max(8, centerX - POPOVER_WIDTH / 2);
  const above = rect.top - 44;
  const top = above < 8 ? rect.bottom + 8 : above;

  return (
    <div
      ref={ref}
      className="fixed z-50"
      style={{ top, left }}
      role="toolbar"
      aria-label="Annotation toolbar"
    >
      <button
        type="button"
        onMouseDown={(e) => {
          // Prevent the document mousedown from blowing away the selection
          // before we get the click.
          e.preventDefault();
        }}
        onClick={onAnnotate}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-900 text-white text-sm shadow-lg hover:bg-gray-800"
      >
        <Highlighter className="w-4 h-4" />
        Annotate
      </button>
    </div>
  );
}
