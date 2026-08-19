"use client";

/**
 * "Send reset" button for a user row.
 *
 * Lives in components/ rather than in any one route tree because four
 * surfaces need it — /admin/users, /district/users, /school/teachers and
 * /school/students — and CLAUDE.md §5 puts shared UI here rather than in
 * whichever tree happened to build it first.
 *
 * Authorization is entirely server-side in sendPasswordResetToUser(). This
 * component decides only what to render; a user who hand-calls the action for
 * someone outside their scope gets refused there.
 *
 * No confirm() dialog. Sending a reset is reversible in the sense that
 * matters — the target's existing password keeps working until they actually
 * use the link — so a confirmation step would be friction on the common path
 * for no protection. The throttle covers a double click.
 */

import { useState, useTransition } from "react";
import { KeyRound, Check, AlertCircle } from "lucide-react";
import { sendPasswordResetToUser } from "@/lib/actions/password-reset";

type Outcome = { kind: "ok" | "error"; text: string } | null;

export function SendResetButton({
  userId,
  userLabel,
}: {
  userId: string;
  /** Who this resets, for the screenreader label — "Send password reset to Diana Carcano". */
  userLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<Outcome>(null);

  function onClick() {
    setOutcome(null);
    startTransition(async () => {
      const result = await sendPasswordResetToUser(userId);
      setOutcome(
        result.ok
          ? { kind: "ok", text: result.message }
          : { kind: "error", text: result.error }
      );
    });
  }

  // Once sent, say so and stop offering the button again — the throttle would
  // refuse a second press within the minute anyway, and an admin who has just
  // been told "sent" pressing again is asking whether the first one worked.
  if (outcome?.kind === "ok") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
        <Check className="h-4 w-4" aria-hidden="true" />
        Reset sent
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand,#e11d48)] disabled:opacity-60"
      >
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        {pending ? "Sending…" : "Send reset"}
        {/* The visible label is just "Send reset" so the column stays narrow;
            the name makes it unambiguous for anyone hearing it out of the
            row's visual context. */}
        <span className="sr-only"> password reset to {userLabel}</span>
      </button>

      {outcome?.kind === "error" && (
        <span
          role="alert"
          className="inline-flex items-start gap-1 text-xs text-red-700"
        >
          <AlertCircle
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />
          {outcome.text}
        </span>
      )}
    </span>
  );
}
