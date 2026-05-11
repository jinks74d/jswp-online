"use client";

/**
 * Exemplar reference panel rendered in the writing-shell when matching
 * exemplars exist (chunk 6.1).
 *
 * Collapsible <details>; each exemplar title is its own <details> that
 * expands to show the full_text. Server already filtered to published
 * exemplars from the student's teacher(s) matching the writing's mode.
 *
 * Marked "use client" only so the <details> animation doesn't fight
 * RSC hydration; no state of our own.
 */

import { BookOpenCheck, Target } from "lucide-react";
import type { ExemplarForStudent } from "@/lib/queries/exemplars";

interface Props {
  exemplars: readonly ExemplarForStudent[];
}

export function ExemplarReference({ exemplars }: Props) {
  if (exemplars.length === 0) return null;

  // When the query returned step-matched exemplars (rather than the
  // fallback pool), surface that to the student so they know these
  // are tailored to where they are in the writing flow.
  const matched = exemplars.some((e) => e.matchedCurrentStep);

  return (
    <details className="rounded-lg border border-gray-200 bg-white group">
      <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none">
        <div className="flex items-center gap-2 flex-wrap">
          <BookOpenCheck className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-900">
            Reference {exemplars.length === 1 ? "exemplar" : "exemplars"} for
            this mode
          </span>
          <span className="text-xs text-gray-500">
            ({exemplars.length})
          </span>
          {matched && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-800">
              <Target className="w-3 h-3" />
              Matched to current step
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500 group-open:hidden">Show</span>
        <span className="text-xs text-gray-500 hidden group-open:inline">
          Hide
        </span>
      </summary>

      <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
        {exemplars.map((ex) => (
          <details
            key={ex.id}
            className="rounded-md border border-gray-200 bg-gray-50"
          >
            <summary className="px-3 py-2 cursor-pointer list-none">
              <div className="text-sm font-medium text-gray-900">
                {ex.title}
              </div>
              {ex.description && (
                <p className="text-xs text-gray-600 mt-0.5">
                  {ex.description}
                </p>
              )}
            </summary>
            <div className="px-3 pb-3 border-t border-gray-200 pt-2">
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-900 leading-relaxed">
                {ex.full_text}
              </pre>
            </div>
          </details>
        ))}
      </div>
    </details>
  );
}
