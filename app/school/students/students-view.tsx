"use client";

/**
 * School Students view — same style as Teachers. Stat cards (total / enrolled /
 * not enrolled / new this month), name/email search, a table of the school's
 * students (with grade), and a roster overview. "Add Student" opens a modal.
 * Per-row edit/delete is omitted for now (no school-admin edit action yet).
 */

import { useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Mail,
  Plus,
  Search,
  UserX,
  Users as UsersIcon,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { OverviewStat } from "@/components/ui/overview-stat";
import { AddStudentModal } from "./add-student-modal";

export type StudentRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  gradeLevel: string | null;
  studentIdExternal: string | null;
  active: boolean;
  createdAt: string | null;
};

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "short" });
const fmtDate = (iso: string | null) =>
  iso ? dateFmt.format(new Date(iso)) : "—";

const studentName = (s: StudentRow) =>
  [s.firstName, s.lastName].filter(Boolean).join(" ") || "Unnamed student";

export function StudentsView({
  schoolName,
  students,
  enrolledIds,
}: {
  schoolName: string;
  students: readonly StudentRow[];
  enrolledIds: readonly string[];
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const enrolledSet = useMemo(() => new Set(enrolledIds), [enrolledIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        studentName(s).toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.studentIdExternal ?? "").toLowerCase().includes(q)
    );
  }, [students, query]);

  const total = students.length;
  const enrolled = useMemo(
    () => students.filter((s) => enrolledSet.has(s.id)).length,
    [students, enrolledSet]
  );
  const notEnrolled = total - enrolled;
  const newThisMonth = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return students.filter(
      (s) => s.createdAt && new Date(s.createdAt).getTime() >= start
    ).length;
  }, [students]);
  const enrolledPct = total ? `${Math.round((enrolled / total) * 100)}%` : "0%";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {schoolName} Students
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage students at {schoolName}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-contrast)] transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Student
        </button>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Students" value={total} icon={UsersIcon} tint="bg-sky-50 text-sky-600" />
        <StatCard label="Enrolled" value={enrolled} icon={BookOpen} tint="bg-emerald-50 text-emerald-600" />
        <StatCard label="Not Enrolled" value={notEnrolled} icon={UserX} tint="bg-[var(--brand-soft)] text-[var(--brand)]" />
        <StatCard label="New This Month" value={newThisMonth} icon={CalendarDays} tint="bg-violet-50 text-violet-600" />
      </div>

      {/* ── Search ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students by name, email, or ID…"
            aria-label="Search students"
            className="w-full rounded-lg border border-gray-400 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
          />
        </div>
        <span className="whitespace-nowrap text-sm text-gray-500">
          {filtered.length} of {total} {total === 1 ? "student" : "students"}
        </span>
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-300">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">Student</th>
              <th scope="col" className="px-5 py-3 font-medium">Grade</th>
              <th scope="col" className="px-5 py-3 font-medium">Joined</th>
              <th scope="col" className="px-5 py-3 font-medium">Enrollment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-sm font-semibold text-[var(--brand-contrast)]">
                      {(s.firstName?.[0] ?? s.email?.[0] ?? "?").toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">
                        {studentName(s)}
                        {s.studentIdExternal && (
                          <span className="ml-2 font-normal text-gray-500">
                            #{s.studentIdExternal}
                          </span>
                        )}
                      </p>
                      <p className="flex items-center gap-1 truncate text-xs text-gray-500">
                        <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {s.email ?? "—"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className={s.gradeLevel ? "text-gray-700" : "text-gray-500"}>
                    {s.gradeLevel ? `Grade ${s.gradeLevel}` : "—"}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-500">{fmtDate(s.createdAt)}</td>
                <td className="px-5 py-3">
                  <EnrollmentPill enrolled={enrolledSet.has(s.id)} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-gray-500">
                  {total === 0
                    ? "No students yet. Use “Add Student” to add the first one."
                    : "No students match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Roster overview ─────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-xl border border-gray-200 border-t-[3px] border-t-[var(--brand)] bg-white shadow-sm">
        <div className="bg-gray-900 px-5 py-4">
          <h2 className="text-sm font-bold text-white">Student Roster Overview</h2>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-gray-100">
          <OverviewStat label="Total Students" value={total} icon={UsersIcon} tint="bg-sky-50 text-sky-600" />
          <OverviewStat label="Enrolled" value={enrolledPct} icon={BookOpen} tint="bg-emerald-50 text-emerald-600" accent />
          <OverviewStat label="New This Month" value={newThisMonth} icon={CalendarDays} tint="bg-violet-50 text-violet-600" />
        </dl>
      </section>

      {adding && <AddStudentModal onClose={() => setAdding(false)} />}
    </div>
  );
}


function EnrollmentPill({ enrolled }: { enrolled: boolean }) {
  return enrolled ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
      Enrolled
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" aria-hidden="true" />
      Not enrolled
    </span>
  );
}
