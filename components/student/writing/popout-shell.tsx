"use client";

/**
 * Full-screen "pop out" wrapper for a step's working area.
 *
 * The student surfaces are two-column by design — work on the left, source on
 * the right — which is right for the flow and cramped for the moments where
 * you actually need to read. This expands its subtree to the whole viewport
 * without unmounting anything, so filters, scroll position and in-flight edits
 * all survive the toggle.
 *
 * Accessibility, all of it load-bearing rather than decoration:
 *   * role=dialog + aria-modal while open, and the panel IS the modal surface
 *     (opaque, full-bleed) so there is no separate backdrop to stack against
 *     anything rendered inside it.
 *   * Focus moves to the collapse button on open and returns to whatever
 *     opened it on close (WCAG 2.4.3 Focus Order).
 *   * The page behind cannot scroll while it is up.
 *   * Escape closes, Tab is trapped inside.
 *
 * Escape defers when the event is already defaultPrevented. Inner layers own
 * it first — the PDF viewer consumes Escape to leave keyboard-selection mode,
 * and closing the whole view out from under a student who was only trying to
 * drop a selection is a worse bug than the one this solves.
 *
 * Extracted from annotate-text-client.tsx, which still carries its own copy:
 * its Escape handling is additionally entangled with an annotation form and a
 * selection popover that have no equivalent here. Folding that in is a
 * separate change — see docs/BACKLOG.md.
 */

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

interface Props {
  /** Accessible name for the dialog while expanded. */
  label: string;
  /** Left-hand content of the header bar, beside the toggle. */
  heading?: React.ReactNode;
  /** Receives the current state so children can adapt sticky offsets etc. */
  children: (expanded: boolean) => React.ReactNode;
  /** Outer classes applied only when collapsed. */
  className?: string;
}

export function PopoutShell({ label, heading, children, className }: Props) {
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const collapseButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!expanded) return;
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    collapseButtonRef.current?.focus();
    return () => previouslyFocusedRef.current?.focus();
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (event.defaultPrevented) return;
        event.preventDefault();
        setExpanded(false);
        return;
      }

      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;

      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  return (
    <section
      ref={panelRef}
      className={
        expanded
          ? // overflow-auto, not overflow-y-auto: a wide table in a rich
            // source still needs to be reachable sideways.
            "fixed inset-0 z-40 space-y-4 overflow-auto bg-gray-50 p-4 sm:p-6"
          : (className ?? "space-y-4")
      }
      {...(expanded
        ? { role: "dialog", "aria-modal": true, "aria-label": label }
        : {})}
    >
      <div
        className={
          expanded
            ? "sticky top-0 z-30 -mx-4 flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 pb-3 sm:-mx-6 sm:px-6"
            : "flex items-center justify-between gap-3"
        }
      >
        {heading ?? <span />}
        {/* Brand-filled, not white-on-white: the toggle sits on the card it
            expands, so a neutral chip disappeared into the surface. --brand-
            contrast, never text-white — a light district colour needs dark ink. */}
        <button
          ref={collapseButtonRef}
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={expanded}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand)] px-2.5 py-1 text-xs font-medium text-[var(--brand-contrast)] shadow-sm transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
        >
          {expanded ? (
            <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {expanded ? "Exit full screen" : "Pop out"}
        </button>
      </div>

      {children(expanded)}
    </section>
  );
}
