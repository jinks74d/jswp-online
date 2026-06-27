"use client";

/**
 * Header actions for the Districts dashboard: "New district" and "Import CSV"
 * triggers that open a centered modal to the matching tab. Reuses the existing
 * <DistrictForm> and <CsvImporter> verbatim — this component only owns the
 * open/close + tab chrome.
 *
 * The dialog mirrors the a11y contract proven in DeleteConfirmationModal:
 * role="dialog" + aria-modal, focus moves in on open and returns to the trigger
 * on close, Escape and backdrop-click close, Tab is trapped, and a visible
 * close button is provided. Motion is limited to transform/opacity so the
 * global prefers-reduced-motion reset can neutralise it.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Building2, Plus, Upload, X } from "lucide-react";
import { CsvImporter } from "@/components/admin/csv-importer";
import { DistrictForm } from "./district-form";

type Tab = "create" | "import";

export function NewDistrictPanel() {
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [tab, setTab] = useState<Tab>("create");

  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // The trigger that opened the dialog, so focus can return to it on close.
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const openWith = useCallback((next: Tab) => {
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setTab(next);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setEntered(false);
    previouslyFocusedRef.current?.focus();
  }, []);

  // Move focus into the panel and trigger the enter transition when it opens.
  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    setEntered(true);
  }, [open]);

  // Escape closes; Tab is trapped within the panel.
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
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => openWith("create")}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New district
        </button>
        <button
          type="button"
          onClick={() => openWith("import")}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          Import CSV
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop — click closes. */}
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
            className={`relative flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5 transition duration-150 ${
              entered ? "scale-100 opacity-100" : "scale-95 opacity-0"
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  {tab === "create" ? (
                    <Building2 className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Upload className="h-5 w-5" aria-hidden="true" />
                  )}
                </span>
                <div>
                  <h2
                    id={titleId}
                    className="text-lg font-semibold text-gray-900"
                  >
                    {tab === "create" ? "New district" : "Import districts"}
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {tab === "create"
                      ? "Set up a district and its two points of contact."
                      : "Bulk-add districts from a CSV or spreadsheet."}
                  </p>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={close}
                aria-label="Close dialog"
                className="-m-1 shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Segmented tabs */}
            <div className="px-6 pt-4">
              <div
                role="tablist"
                aria-label="Add districts"
                className="inline-flex rounded-lg bg-gray-100 p-1"
              >
                <TabButton
                  id={`${titleId}-tab-create`}
                  panelId={`${titleId}-panel-create`}
                  selected={tab === "create"}
                  onSelect={() => setTab("create")}
                >
                  Create
                </TabButton>
                <TabButton
                  id={`${titleId}-tab-import`}
                  panelId={`${titleId}-panel-import`}
                  selected={tab === "import"}
                  onSelect={() => setTab("import")}
                >
                  Import
                </TabButton>
              </div>
            </div>

            {/* Body (scrolls) */}
            <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
              {tab === "create" ? (
                <div
                  role="tabpanel"
                  id={`${titleId}-panel-create`}
                  aria-labelledby={`${titleId}-tab-create`}
                >
                  <DistrictForm mode="create" />
                </div>
              ) : (
                <div
                  role="tabpanel"
                  id={`${titleId}-panel-import`}
                  aria-labelledby={`${titleId}-tab-import`}
                >
                  <CsvImporter
                    entity="districts"
                    sampleHeaders={["name", "subdomain", "contact_email"]}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TabButton({
  id,
  panelId,
  selected,
  onSelect,
  children,
}: {
  id: string;
  panelId: string;
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={selected}
      aria-controls={panelId}
      onClick={onSelect}
      className={`rounded-md px-4 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        selected
          ? "bg-white text-gray-900 shadow-sm"
          : "text-gray-500 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}
