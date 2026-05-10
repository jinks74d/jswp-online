"use client";

/**
 * Hook for reading writing-flow UI state. Throws if used outside a
 * WritingModeProvider — the writing flow is the only place that
 * should mount these components, so absence of the provider is a bug.
 */

import { useContext } from "react";
import { WritingModeContext, type WritingMode } from "./writing-mode-provider";

export function useWritingMode(): WritingMode {
  const ctx = useContext(WritingModeContext);
  if (ctx === null) {
    throw new Error(
      "useWritingMode must be called inside a <WritingModeProvider>"
    );
  }
  return ctx;
}
