"use client";

/**
 * Faithful .docx renderer. Fetches the stored Word file (short-lived signed
 * URL) and renders it with docx-preview, which reproduces the original
 * document — paragraphs, headings, images, tables, fonts, and page layout —
 * rather than the flattened mammoth HTML used for the annotation substrate.
 *
 * docx-preview is dynamically imported so it stays out of the initial bundle;
 * it injects its own scoped styles into the render container. If the fetch or
 * render fails, we surface a message pointing at "Open original" (the raw
 * file) so the student is never blocked.
 *
 * This is display-only — it does not participate in annotation (offsets live
 * on the plain `source_text` substrate, rendered by SourceTextViewer).
 */

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

export function DocxViewer({ fileUrl }: { fileUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    (async () => {
      try {
        setStatus("loading");
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;

        const { renderAsync } = await import("docx-preview");
        // Clear any prior render (effect re-runs if the URL changes).
        container.innerHTML = "";
        await renderAsync(buf, container, undefined, {
          className: "docx",
          inWrapper: true,
          breakPages: true,
          ignoreWidth: false,
          ignoreHeight: false,
        });
        if (!cancelled) setStatus("ready");
      } catch (e) {
        console.error("docx render:", e);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  return (
    <div className="space-y-2">
      {status === "loading" && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading document…
        </div>
      )}
      {status === "error" && (
        <div role="alert" className="text-sm text-red-700">
          Couldn’t display the document here. Use “Open original” to view it.
        </div>
      )}
      {/* docx-preview paints scaled white "pages"; a neutral backdrop +
          horizontal scroll preserve the original page dimensions. */}
      <div
        ref={containerRef}
        className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-100 p-2"
      />
    </div>
  );
}
