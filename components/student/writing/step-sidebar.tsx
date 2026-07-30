"use client";

/**
 * Vertical step list shown to the student inside the writing flow.
 * Three visual states per step:
 *   completed  → checkmark, gray, clickable (revisit)
 *   current    → brand color highlight, bold, clickable
 *   upcoming   → gray, NOT clickable (pedagogical guard against
 *                skipping ahead — sequence matters)
 *
 * On phones (< md) the list collapses into a top accordion via the
 * <details> element. The currently-active step is shown in the closed
 * summary so the student knows where they are without expanding.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Lock } from "lucide-react";
import type { StepConfig } from "@/lib/jswp-modes";

export interface StepSidebarProps {
  writingId: string;
  steps: readonly StepConfig[];
  currentStepKey: string | null;
  completedKeys: ReadonlySet<string>;
}

interface StepUI {
  step: StepConfig;
  state: "completed" | "current" | "upcoming";
  reachable: boolean;
}

function decorateSteps({
  steps,
  currentStepKey,
  completedKeys,
}: Pick<
  StepSidebarProps,
  "steps" | "currentStepKey" | "completedKeys"
>): StepUI[] {
  const currentIdx = steps.findIndex((s) => s.key === currentStepKey);
  return steps.map((step, idx) => {
    const isCompleted = completedKeys.has(step.key);
    const isCurrent = step.key === currentStepKey;
    const reachable = idx <= (currentIdx === -1 ? steps.length - 1 : currentIdx);
    return {
      step,
      state: isCurrent ? "current" : isCompleted ? "completed" : "upcoming",
      reachable,
    };
  });
}

export function StepSidebar(props: StepSidebarProps) {
  const decorated = decorateSteps(props);
  const active = decorated.find((d) => d.state === "current") ?? decorated[0];

  return (
    <>
      {/* Mobile: collapsible at top */}
      <details className="md:hidden bg-white border border-gray-200 rounded-lg group">
        <summary className="flex items-center justify-between gap-3 p-4 cursor-pointer list-none">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-gray-500">
              Current Step
            </div>
            <div className="text-sm font-semibold text-gray-900 truncate">
              {active.step.label}
            </div>
          </div>
          <span className="text-xs text-gray-500 group-open:hidden">
            View all steps
          </span>
          <span className="text-xs text-gray-500 hidden group-open:inline">
            Hide
          </span>
        </summary>
        <div className="px-2 pb-3 pt-1 border-t border-gray-100">
          <StepList writingId={props.writingId} items={decorated} />
        </div>
      </details>

      {/* Desktop: persistent rail */}
      <aside className="hidden md:block bg-white border border-gray-200 rounded-lg p-3 sticky top-20">
        <div className="px-2 pb-2 text-xs uppercase tracking-wide text-gray-500 font-semibold">
          Steps
        </div>
        <StepList writingId={props.writingId} items={decorated} />
      </aside>
    </>
  );
}

function StepList({
  writingId,
  items,
}: {
  writingId: string;
  items: readonly StepUI[];
}) {
  const pathname = usePathname();
  return (
    <ol className="space-y-1">
      {items.map(({ step, state, reachable }) => {
        const href = `/student/writings/${writingId}/${step.slug}`;
        const isOnRoute = pathname === href;

        const baseRow =
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors";

        if (!reachable) {
          return (
            <li key={step.key}>
              <div
                className={`${baseRow} text-gray-400 cursor-not-allowed select-none`}
                aria-disabled="true"
                title="Complete the current step to unlock this one"
              >
                <Lock className="w-4 h-4" aria-hidden="true" />
                <span className="truncate">{step.label}</span>
              </div>
            </li>
          );
        }

        const isCurrent = state === "current";
        return (
          <li key={step.key}>
            <Link
              href={href}
              aria-current={isOnRoute ? "page" : undefined}
              className={`${baseRow} ${
                isCurrent
                  ? "bg-gray-100 text-gray-900 border-l-2 font-semibold"
                  : "text-gray-700 hover:bg-gray-50 border-l-2 border-transparent"
              }`}
              style={
                isCurrent
                  ? { borderLeftColor: "var(--district-primary)" }
                  : undefined
              }
            >
              {state === "completed" ? (
                <Check
                  className="w-4 h-4 text-green-600"
                  aria-label="Completed"
                />
              ) : (
                <span
                  className="w-4 h-4 rounded-full border"
                  style={
                    isCurrent
                      ? {
                          borderColor: "var(--district-primary)",
                          backgroundColor: "var(--district-primary)",
                        }
                      : { borderColor: "#9ca3af" }
                  }
                  aria-hidden="true"
                />
              )}
              <span className="truncate">{step.label}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
