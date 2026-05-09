/**
 * Student-facing assignment detail. Shows title / mode / prompt /
 * due-date prominently; source text and rubric are collapsed by
 * default to keep the prompt as the visual focus.
 *
 * The CTA button is a STUB in chunk 4.1 — chunk 4.2 wires the actual
 * student-writing creation + step-engine entry. The four CTA strings
 * (Start / Continue / Continue Revision / Review) all submit to the
 * same noop server action so the loading state behaves like the real
 * thing will.
 */

import { notFound } from "next/navigation";
import { Calendar, FileText } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getStudentAssignmentDetail } from "@/lib/queries/student-assignments";
import { StatusBadge } from "@/components/student/status-badge";
import { StartWritingButton } from "./start-writing-button";
import { startWriting } from "@/lib/actions/student-writings";

export const dynamic = "force-dynamic";

const MODE_LABELS = {
  expository: "Expository",
  argumentation: "Argumentation",
  literary: "Literary Analysis",
  narrative: "Narrative",
} as const;

export default async function StudentAssignmentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireRole("student");
  const { id } = await params;
  const item = await getStudentAssignmentDetail(id, profile.id);

  if (!item) {
    notFound();
  }

  const dueText = formatDue(item.due_at);
  const ctaLabel = ctaLabelFor(item.status);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
          {MODE_LABELS[item.mode]}
          {item.is_essay && <span className="text-gray-400">· essay</span>}
        </div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{item.title}</h1>
          <StatusBadge status={item.status} />
        </div>
        {dueText && (
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            {dueText}
          </div>
        )}
        {item.status === "graded" && item.writing?.total_score !== null && item.writing && (
          <div className="text-sm text-gray-700">
            <span className="font-medium">Score:</span> {item.writing.total_score}
          </div>
        )}
      </header>

      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">
          Prompt
        </h2>
        <p className="text-gray-800 whitespace-pre-wrap">{item.prompt}</p>
      </section>

      {item.source_text && (
        <details className="bg-white border border-gray-200 rounded-lg group">
          <summary className="flex items-center justify-between gap-3 p-5 cursor-pointer list-none">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Source text
              </h2>
              {item.source_title && (
                <span className="text-sm text-gray-600 normal-case font-normal">
                  · {item.source_title}
                  {item.source_author ? ` — ${item.source_author}` : ""}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500 group-open:hidden">
              Show
            </span>
            <span className="text-xs text-gray-500 hidden group-open:inline">
              Hide
            </span>
          </summary>
          <div className="px-5 pb-5 border-t border-gray-100 pt-4">
            <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
              {item.source_text}
            </p>
            {item.source_citation && (
              <p className="mt-4 text-xs text-gray-500 italic">
                {item.source_citation}
              </p>
            )}
          </div>
        </details>
      )}

      {item.rubric && (
        <details className="bg-white border border-gray-200 rounded-lg group">
          <summary className="flex items-center justify-between gap-3 p-5 cursor-pointer list-none">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Rubric
            </h2>
            <span className="text-xs text-gray-500 group-open:hidden">
              Show
            </span>
            <span className="text-xs text-gray-500 hidden group-open:inline">
              Hide
            </span>
          </summary>
          <div className="px-5 pb-5 border-t border-gray-100 pt-4">
            <pre className="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap font-mono">
              {JSON.stringify(item.rubric, null, 2)}
            </pre>
          </div>
        </details>
      )}

      <div className="flex justify-start">
        <form action={startWriting.bind(null, item.id)}>
          <StartWritingButton label={ctaLabel} />
        </form>
      </div>
    </div>
  );
}

function ctaLabelFor(
  status: import("@/lib/queries/student-assignments").DerivedStatus
): string {
  switch (status) {
    case "not_started":
      return "Start Writing";
    case "in_progress":
      return "Continue Writing";
    case "returned":
      return "Continue Revision";
    case "submitted":
    case "graded":
      return "Review Submission";
  }
}

function formatDue(isoDue: string | null): string | null {
  if (!isoDue) return null;
  const due = new Date(isoDue);
  const now = Date.now();
  const diffMs = due.getTime() - now;
  const dayMs = 24 * 60 * 60 * 1000;
  const dateStr = due.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (diffMs < 0) return `Due ${dateStr} (overdue)`;
  if (diffMs < dayMs) return `Due ${dateStr} (today)`;
  const days = Math.ceil(diffMs / dayMs);
  return `Due ${dateStr} (in ${days} ${days === 1 ? "day" : "days"})`;
}
