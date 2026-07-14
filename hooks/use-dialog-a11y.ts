"use client";

/**
 * Accessibility plumbing for a modal dialog (WCAG 2.1.2 / 2.4.3 / 4.1.2):
 *   - captures the element that had focus before the dialog opened,
 *   - moves focus into the dialog on open (a provided ref, else the first
 *     focusable, else the panel itself),
 *   - traps Tab / Shift+Tab within the panel so focus can't reach the inert
 *     background,
 *   - closes on Escape (unless `locked`, e.g. mid-submit),
 *   - restores focus to the original trigger on close.
 *
 * Extracted from DeleteConfirmationModal so every dialog shares one correct
 * implementation instead of re-deriving a partial one. The caller still owns
 * markup: put `role="dialog" aria-modal="true" aria-labelledby=…` on the
 * panel and pass its ref here.
 */

import { useEffect } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Structural ref shapes (readonly `current`, so they accept any concrete
// element ref — RefObject<HTMLDivElement>, an input ref, etc. — without a cast).
interface Options {
  isOpen: boolean;
  onClose: () => void;
  panelRef: { readonly current: HTMLElement | null };
  /** Element to focus first; defaults to the panel's first focusable. */
  initialFocusRef?: { readonly current: { focus: () => void } | null };
  /** When true, Escape does not close (e.g. a submit is in flight). */
  locked?: boolean;
}

export function useDialogA11y({
  isOpen,
  onClose,
  panelRef,
  initialFocusRef,
  locked = false,
}: Options): void {
  // Capture prior focus, move focus in on open, restore it on close.
  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    if (initialFocusRef?.current) {
      initialFocusRef.current.focus();
    } else {
      const panel = panelRef.current;
      const firstFocusable =
        panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      firstFocusable?.focus();
    }

    return () => previouslyFocused?.focus();
    // Focus setup should run once per open, not on ref identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Escape to close + Tab trap.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!locked) {
          event.preventDefault();
          onClose();
        }
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !panel.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // onClose is stable enough for this effect; re-bind on open/lock changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, locked]);
}
