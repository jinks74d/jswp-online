"use client";

/**
 * Native-confirm delete trigger for an exemplar (chunk 6.1). Wraps a
 * pre-bound server action; click prompts the user, runs the action,
 * and lets the server-side redirect handle navigation.
 */

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";

interface Props {
  action: () => Promise<void>;
}

export function DeleteExemplarButton({ action }: Props) {
  const [pending, start] = useTransition();

  const onClick = () => {
    if (
      !window.confirm(
        "Delete this exemplar? Students who saw the published version will lose access."
      )
    ) {
      return;
    }
    start(async () => {
      try {
        await action();
      } catch (e) {
        window.alert(
          e instanceof Error ? e.message : "Could not delete exemplar."
        );
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Trash2 className="w-4 h-4" />
      )}
      Delete
    </button>
  );
}
