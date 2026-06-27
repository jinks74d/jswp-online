"use client";

/**
 * "Edit details" button + centered modal for the district detail page. Opens
 * the full edit form (district fields + points of contact) in a dialog, mirroring
 * the New-district modal. a11y: role="dialog" + aria-modal, focus moves in on
 * open and returns to the trigger on close, Escape and backdrop-click close,
 * Tab is trapped. Motion is transform/opacity only so the global
 * prefers-reduced-motion reset neutralises it.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import { DistrictForm, type DistrictInitial } from "../district-form";

export function EditDistrictPanel({ initial }: { initial: DistrictInitial }) {
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);

  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setEntered(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    setEntered(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
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
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
        Edit details
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close dialog"
            tabIndex={-1}
            onClick={close}
            className={`absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity duration-150 ${
              entered ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`relative flex max-h-[calc(100vh-2rem)] w-full max-w-[712px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5 transition duration-150 ${
              entered ? "scale-100 opacity-100" : "scale-95 opacity-0"
            }`}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <Pencil className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 id={titleId} className="text-lg font-semibold text-gray-900">
                    Edit district
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-500">
                    Update {initial.name}&rsquo;s details and points of contact.
                  </p>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={close}
                aria-label="Close dialog"
                className="-m-1 shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <DistrictForm mode="edit" initial={initial} onCancel={close} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
