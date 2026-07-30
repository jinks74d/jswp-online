"use client";

/**
 * Pending-aware submit button for the assignment-detail CTA. Disabled
 * while the form is in flight; copy swaps to "..." so the loading state
 * is unmistakable. Chunk 4.2 will redirect on success — for now the
 * stub action just resolves and the page re-renders, which reverts
 * the button to its idle state.
 */

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export function StartWritingButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md text-base font-semibold text-white shadow-sm transition-colors disabled:opacity-70 disabled:cursor-wait"
      style={{ backgroundColor: "var(--district-primary)" }}
    >
      {pending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
      {pending ? "Loading…" : label}
    </button>
  );
}
