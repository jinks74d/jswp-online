/**
 * Student landing page. Friendly greeting + status counts + a short
 * peek at the most-pressing items (overdue / due-soon / needs-revision).
 * Full list lives at /student/assignments.
 */

import Link from "next/link";
import { FileText, Sparkles } from "lucide-react";
import { requireRole } from "@/lib/auth";
import {
  getStudentAssignmentsList,
  groupByStatus,
  type StudentAssignmentListItem,
} from "@/lib/queries/student-assignments";
import { AssignmentCard } from "@/components/student/assignment-card";

export const dynamic = "force-dynamic";

export default async function StudentHome() {
  const profile = await requireRole("student");
  const items = await getStudentAssignmentsList(profile.id);
  const groups = groupByStatus(items);

  const greeting = profile.first_name
    ? `Welcome, ${profile.first_name}`
    : "Welcome";

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
        </header>
        <EmptyState />
      </div>
    );
  }

  const todoCount = groups.not_started.length;
  const inProgressCount = groups.in_progress.length;
  const needsRevisionCount = groups.returned.length;
  const submittedCount = groups.submitted.length;
  const gradedCount = groups.graded.length;

  // Highlight the items the student should act on first.
  const priority = pickPriority(items);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
        <p className="text-gray-600">
          Here&apos;s a quick look at where your work stands.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="To do" value={todoCount} />
        <StatCard label="In progress" value={inProgressCount} />
        <StatCard label="Needs revision" value={needsRevisionCount} />
        <StatCard label="Submitted" value={submittedCount} />
        <StatCard label="Graded" value={gradedCount} />
      </div>

      {priority.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Pick up where you left off
            </h2>
            <Link
              href="/student/assignments"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              See all
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {priority.map((item) => (
              <AssignmentCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
      <Sparkles className="w-10 h-10 text-blue-600 mx-auto mb-4" />
      <h2 className="text-lg font-semibold text-gray-900">No assignments yet</h2>
      <p className="text-sm text-gray-600 mt-2 max-w-md mx-auto">
        Your teacher will assign work to you here. Check back soon.
      </p>
      <div className="mt-5">
        <Link
          href="/student/assignments"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <FileText className="w-4 h-4" />
          View My Assignments
        </Link>
      </div>
    </div>
  );
}

/**
 * Surface the items most likely to need attention: returned > overdue >
 * due-soon > anything else in progress > anything else not started. Cap
 * the spotlight at 4 cards.
 */
function pickPriority(
  items: readonly StudentAssignmentListItem[]
): StudentAssignmentListItem[] {
  const now = Date.now();
  const score = (item: StudentAssignmentListItem): number => {
    if (item.status === "returned") return 0;
    const due = item.due_at ? new Date(item.due_at).getTime() : null;
    if (item.status === "not_started" || item.status === "in_progress") {
      if (due !== null && due < now) return 1; // overdue
      if (due !== null && due - now < 24 * 60 * 60 * 1000) return 2; // due today
      if (item.status === "in_progress") return 3;
      return 4;
    }
    return 9; // submitted / graded
  };
  return [...items].sort((a, b) => score(a) - score(b)).slice(0, 4);
}
