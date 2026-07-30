"use client";

/**
 * Provides flow-wide UI state for the student writing flow. Currently
 * just `isReadOnly` — true when the writing's status locks editing
 * (submitted / graded). RLS enforces it server-side; this Context lets
 * leaf components disable inputs and hide affordances without prop
 * drilling through ~30 layers.
 *
 * Wrapped once at app/student/writings/[id]/layout.tsx. Consumed via
 * the useWritingMode() hook (./use-writing-mode.ts).
 *
 * isTerminal stays a prop on the [Continue]/[Submit] button host —
 * it's per-step, not flow-wide.
 */

import { createContext, type ReactNode } from "react";

export interface WritingMode {
  readonly isReadOnly: boolean;
}

export const WritingModeContext = createContext<WritingMode | null>(null);

export function WritingModeProvider({
  isReadOnly,
  children,
}: {
  isReadOnly: boolean;
  children: ReactNode;
}) {
  return (
    <WritingModeContext.Provider value={{ isReadOnly }}>
      {children}
    </WritingModeContext.Provider>
  );
}
