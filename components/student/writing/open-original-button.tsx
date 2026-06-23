"use client";

/**
 * "Open original" affordance for the annotate / reference surfaces. The
 * student keeps working against the plain highlightable text (the
 * annotation substrate), and this button opens the teacher's uploaded
 * file — formatted PDF / .docx — in a new tab.
 *
 * Mints a fresh signed URL on click (the URL is short-lived; minting on
 * demand keeps it valid however long the page sat open) then opens it.
 * Renders nothing when no file is attached.
 */

import { useTransition, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { getWritingSourceUrl } from "@/lib/actions/source-files";

export function OpenOriginalButton({
  writingId,
  fileName,
}: {
  writingId: string;
  fileName?: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    setError(null);
    start(async () => {
      const res = await getWritingSourceUrl(writingId);
      if (res.ok) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={open}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        Open original{fileName ? ` (${fileName})` : ""}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
