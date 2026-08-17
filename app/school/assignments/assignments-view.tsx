"use client";

/**
 * School Assignments view — a read-only monitoring page (school admins can't
 * author assignments; those are teacher-owned). Stat cards, search + subject +
 * status filters, and assignments grouped by teacher as cards with their
 * status and submission counts.
 */

import { useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Search,
  Users,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import type {
  AssignmentStatus,
  SchoolAssignmentRow,
  SchoolAssignmentStats,
} from "@/lib/queries/school-assignments";

// due dates are calendar-only, stored as UTC midnight — format in UTC so the
// displayed day matches what the teacher entered regardless of viewer tz.
const dateFmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "short",
  timeZone: "UTC",
});
const fmtDate = (iso: string | null) =>
  iso ? dateFmt.format(new Date(iso)) : "—";

const STATUS_META: Record<
  AssignmentStatus,
  { label: string; pill: string; tile: string; accent: string }
> = {
  active: {
    label: "Active",
    pill: "bg-emerald-50 text-emerald-700",
    tile: "bg-emerald-50 text-emerald-600",
    accent: "border-t-emerald-500",
  },
  overdue: {
    label: "Overdue",
    pill: "bg-red-50 text-red-700",
    tile: "bg-red-50 text-red-600",
    accent: "border-t-red-500",
  },
  draft: {
    label: "Draft",
    pill: "bg-gray-100 text-gray-600",
    tile: "bg-gray-100 text-gray-500",
    accent: "border-t-gray-300",
  },
};

export function AssignmentsView({
  schoolName,
  rows,
  stats,
  subjects,
}: {
  schoolName: string;
  rows: readonly SchoolAssignmentRow[];
  stats: SchoolAssignmentStats;
  subjects: readonly string[];
}) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("all");
  const [status, setStatus] = useState("all");

  const teacherOrder = useMemo(() => {
    const seen: string[] = [];
    for (const a of rows) if (!seen.includes(a.teacherName)) seen.push(a.teacherName);
    return seen;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (a) =>
        (!q ||
          [a.title, a.className ?? "", a.teacherName, a.subjectName ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(q)) &&
        (subject === "all" || a.subjectName === subject) &&
        (status === "all" || a.status === status)
    );
  }, [rows, query, subject, status]);

  const groups = useMemo(
    () =>
      teacherOrder
        .map((t) => ({
          teacher: t,
          items: filtered.filter((a) => a.teacherName === t),
        }))
        .filter((g) => g.items.length > 0),
    [teacherOrder, filtered]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {schoolName} Assignments
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Monitor assignments across {schoolName}
        </p>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Assignments" value={stats.total} icon={ClipboardList} tint="bg-sky-50 text-sky-600" />
        <StatCard label="Active" value={stats.active} icon={CheckCircle2} tint="bg-emerald-50 text-emerald-600" />
        <StatCard label="Pending Grading" value={stats.pendingGrading} icon={Clock} tint="bg-amber-50 text-amber-600" />
        <StatCard label="Total Submissions" value={stats.submissions} icon={Users} tint="bg-violet-50 text-violet-600" />
      </div>

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, class, or teacher…"
            aria-label="Search assignments"
            className="w-full rounded-lg border border-gray-500 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
          />
        </div>
        <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Filter by subject" className={selectClass}>
          <option value="all">All Subjects</option>
          {subjects.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className={selectClass}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="overdue">Overdue</option>
          <option value="draft">Draft</option>
        </select>
        <span className="whitespace-nowrap text-sm text-gray-500">
          {filtered.length} of {rows.length}{" "}
          {rows.length === 1 ? "assignment" : "assignments"}
        </span>
      </div>

      {/* ── Teacher groups ──────────────────────────────────────────── */}
      {groups.length > 0 ? (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.teacher}>
              <div className="mb-3.5 flex items-center gap-3 rounded-lg bg-gray-900 px-4 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-semibold text-[var(--brand-contrast)]">
                  {g.teacher[0]?.toUpperCase() ?? "?"}
                </span>
                <span className="text-base font-bold text-white">{g.teacher}</span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-gray-200">
                  {g.items.length} {g.items.length === 1 ? "assignment" : "assignments"}
                </span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                {g.items.map((a) => {
                  const meta = STATUS_META[a.status];
                  return (
                    <div
                      key={a.id}
                      className={`flex flex-col overflow-hidden rounded-xl border border-gray-200 border-t-[4px] ${meta.accent} bg-white shadow-sm`}
                    >
                      <div className="flex-1 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.tile}`}>
                            <FileText className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.pill}`}>
                            {meta.label}
                          </span>
                        </div>
                        <h3 className="mt-3 text-sm font-bold leading-snug text-gray-900">
                          {a.title}
                        </h3>
                        <div className="mt-3 space-y-1.5 text-xs text-gray-600">
                          <p className="flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                            {[a.subjectName, a.className, a.periodLabel].filter(Boolean).join(" · ") || "—"}
                          </p>
                          <p className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                            Due {fmtDate(a.dueAt)}
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                            {a.enrolled > 0
                              ? `${a.submitted}/${a.enrolled} submitted`
                              : `${a.submitted} submitted`}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
          {rows.length === 0
            ? "No assignments yet. Teachers create assignments from their dashboard."
            : "No assignments match your filters."}
        </div>
      )}
    </div>
  );
}

const selectClass =
  "rounded-lg border border-gray-500 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]";

