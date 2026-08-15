"use client";

/**
 * Runs a server action from a client component with the three things every
 * such call site in this app needs: a pending flag, an error message, and the
 * NEXT_REDIRECT swallow.
 *
 * That last one is the reason this exists. A server action that ends in
 * `redirect()` signals the redirect by THROWING a control-flow error whose
 * message is "NEXT_REDIRECT". Next.js catches it above the component and
 * performs the navigation — but a `try/catch` around the `await` sees it
 * first. Catch it and report it, and the user gets "NEXT_REDIRECT" in an
 * error banner while the navigation still happens underneath. Every step in
 * the student writing flow redirects on success, so every call site had to
 * re-derive this rule; it was hand-written in 18 places across 17 files, and
 * a site that forgot it would look fine until the happy path ran.
 *
 * Deliberately generic over the action rather than bound to
 * completeStepAndAdvance: the same shape wraps submitStep, advanceCurrentStep
 * and completePromptDecoding, which differ only in arguments and in the
 * fallback message.
 */

import { useCallback, useState, useTransition } from "react";

export interface RunOptions {
  /**
   * Shown when the thrown error carries no message of its own. Server actions
   * that reject with a readable string surface that string instead.
   */
  fallback?: string;
  /**
   * Handle the failure instead of putting it in `error`. Used by the two
   * fire-and-forget call sites that only log — passing this leaves `error`
   * untouched, so nothing renders a banner they never had.
   */
  onError?: (error: unknown) => void;
}

export interface ServerActionRunner {
  /** True while the transition is in flight. */
  pending: boolean;
  /** Last failure message, or null. Cleared at the start of every run. */
  error: string | null;
  /** Set or clear the message directly, for validation the action never sees. */
  setError: (message: string | null) => void;
  /** Invoke a server action inside a transition, with the redirect swallow. */
  run: (action: () => Promise<unknown>, options?: RunOptions) => void;
}

/** The message Next.js throws to signal a redirect from a server action. */
const NEXT_REDIRECT = "NEXT_REDIRECT";

export function useServerAction(): ServerActionRunner {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    (action: () => Promise<unknown>, options?: RunOptions) => {
      setError(null);
      startTransition(async () => {
        try {
          await action();
        } catch (e) {
          const message = e instanceof Error ? e.message : "";
          // A redirect is success, not failure — let Next.js handle it.
          if (message === NEXT_REDIRECT) return;
          if (options?.onError) {
            options.onError(e);
            return;
          }
          setError(message || options?.fallback || "Could not continue.");
        }
      });
    },
    []
  );

  return { pending, error, setError, run };
}
