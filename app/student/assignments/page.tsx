import type { Metadata } from "next";
/**
 * Full list of the student's assignments, optionally filtered by
 * derived status via the ?status= search param. Filters are simple
 * link buttons that update the URL — no client filter UI.
 */

import Link from "next/link";
import { FileText } from "lucide-react";
import { requireRole } from "@/lib/auth";
import {
  getStudentAssignmentsList,
  groupByStatus,
  type DerivedStatus,
} from "@/lib/queries/student-assignments";
import { getFeedbackSummaryByWriting } from "@/lib/queries/teacher-feedback";
import { hasNewFeedback, byFeedbackFirst } from "@/lib/student-feedback";
import { AssignmentCard } from "@/components/student/assignment-card";

export const dynamic = "force-dynamic";

type FilterValue = DerivedStatus | "all" | "feedback";

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "not_started", label: "To do" },
  { value: "in_progress", label: "In progress" },
  // Means "has feedback waiting", NOT "status is returned" — per-step grading
  // puts notes on writings that were never returned. See lib/student-feedback.
  { value: "feedback", label: "Feedback" },
  { value: "submitted", label: "Submitted" },
  { value: "graded", label: "Graded" },
];

function isDerivedStatus(v: string | undefined): v is DerivedStatus {
  return (
    v === "not_started" ||
    v === "in_progress" ||
    v === "submitted" ||
    v === "returned" ||
    v === "graded"
  );
}

export const metadata: Metadata = { title: "My Assignments" };

export default async function StudentAssignmentsList({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const profile = await requireRole("student");
  const { status: statusParam } = await searchParams;

  const items = await getStudentAssignmentsList(profile.id);

  // Batch-load feedback tallies for the cards. Graded writings are included,
  // not just returned ones: a teacher who grades leaves notes the student had
  // no way of knowing existed. The card decides what to say per status.
  const feedbackWritingIds = items
    .filter(
      (it) =>
        it.writing !== null
    )
    .map((it) => it.writing!.id);
  const feedbackByWriting = await getFeedbackSummaryByWriting(feedbackWritingIds);

  // Pair each assignment with its feedback tally once — the tab counts, the
  // filter and the ordering all need it, and they must agree.
  const withFeedback = items.map((it) => ({
    item: it,
    status: it.status,
    feedback: it.writing
      ? feedbackByWriting.get(it.writing.id) ?? null
      : null,
  }));

  const groups = groupByStatus(items);
  const counts: Record<FilterValue, number> = {
    all: items.length,
    not_started: groups.not_started.length,
    in_progress: groups.in_progress.length,
    submitted: groups.submitted.length,
    returned: groups.returned.length,
    graded: groups.graded.length,
    feedback: withFeedback.filter(hasNewFeedback).length,
  };

  const activeFilter: FilterValue =
    statusParam === "feedback"
      ? "feedback"
      : isDerivedStatus(statusParam)
        ? statusParam
        : "all";

  const filtered = (
    activeFilter === "all"
      ? withFeedback
      : activeFilter === "feedback"
        ? withFeedback.filter(hasNewFeedback)
        : withFeedback.filter((w) => w.status === activeFilter)
    // Feedback leads every view: it is the only thing on this page that is
    // waiting on the student rather than the other way round.
  ).sort(byFeedbackFirst);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">My Assignments</h1>
        <p className="text-gray-600">All assignments your teacher has shared with you.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.value === activeFilter;
          const href =
            f.value === "all"
              ? "/student/assignments"
              : `/student/assignments?status=${f.value}`;
          return (
            <Link
              key={f.value}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                active
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {f.label}
              <span
                className={`text-xs ${
                  active ? "text-white/80" : "text-gray-500"
                }`}
              >
                {counts[f.value]}
              </span>
            </Link>
          );
        })}
      </div>

      {items.length === 0 ? (
        <EmptyAll />
      ) : filtered.length === 0 ? (
        <EmptyFilter />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((w) => (
            <AssignmentCard
              key={w.item.id}
              item={w.item}
              feedback={w.feedback}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyAll() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
      <FileText className="w-10 h-10 text-gray-400 mx-auto mb-4" />
      <h2 className="text-lg font-semibold text-gray-900">
        No assignments yet
      </h2>
      <p className="text-sm text-gray-600 mt-2 max-w-md mx-auto">
        Your teacher will assign work to you here.
      </p>
    </div>
  );
}

function EmptyFilter() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
      <p className="text-sm text-gray-600">No assignments match this filter.</p>
    </div>
  );
}
