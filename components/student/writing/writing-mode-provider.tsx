"use client";

/**
 * Provides flow-wide UI state for the student writing flow:
 *
 *   isReadOnly — true when the writing's status locks editing (submitted /
 *                graded). RLS enforces it server-side; this Context lets leaf
 *                components disable inputs and hide affordances without prop
 *                drilling through ~30 layers.
 *   printMeta  — who/what/when for the header on any printed artifact
 *                (CLAUDE.md §10). Same rationale: the layout already holds the
 *                profile, the assignment and the draft number, and the print
 *                affordances sit several levels down inside step components.
 *
 * `printMeta` is nullable because the teacher's review surface mounts the very
 * same step components (components/dashboard/writing-review/combined-view.tsx)
 * inside its own provider. It deliberately omits the metadata: a grading
 * teacher has no use for a blank copy of the source, so the print affordances
 * simply don't render there.
 *
 * Wrapped once at app/student/writings/[id]/layout.tsx. Consumed via
 * the useWritingMode() hook (./use-writing-mode.ts).
 *
 * isTerminal stays a prop on the [Continue]/[Submit] button host —
 * it's per-step, not flow-wide.
 */

import { createContext, type ReactNode } from "react";
import type { PrintSourceMeta } from "./print/print-source-plan";

export interface WritingMode {
  readonly isReadOnly: boolean;
  readonly printMeta: PrintSourceMeta | null;
}

export const WritingModeContext = createContext<WritingMode | null>(null);

export function WritingModeProvider({
  isReadOnly,
  printMeta = null,
  children,
}: {
  isReadOnly: boolean;
  printMeta?: PrintSourceMeta | null;
  children: ReactNode;
}) {
  return (
    <WritingModeContext.Provider value={{ isReadOnly, printMeta }}>
      {children}
    </WritingModeContext.Provider>
  );
}
