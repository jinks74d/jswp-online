"use client";

/**
 * School Teachers view. Stat cards (total / assigned / unassigned / new this
 * month), name/email search, a table of the school's teachers, and a staff
 * overview. "Add Teacher" opens a modal. Per-row edit/delete is omitted for now
 * (no school-admin edit/deactivate action yet).
 */

import { useMemo, useState } from "react";
import {
  CalendarDays,
  GraduationCap,
  Mail,
  Plus,
  School as SchoolIcon,
  Search,
  UserX,
  Users as UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { AddTeacherModal } from "./add-teacher-modal";

export type TeacherRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  active: boolean;
  createdAt: string | null;
};

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "short" });
const fmtDate = (iso: string | null) =>
  iso ? dateFmt.format(new Date(iso)) : "—";

const teacherName = (t: TeacherRow) =>
  [t.firstName, t.lastName].filter(Boolean).join(" ") || "Unnamed teacher";

export function TeachersView({
  schoolName,
  teachers,
}: {
  schoolName: string;
  teachers: readonly TeacherRow[];
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        teacherName(t).toLowerCase().includes(q) ||
        (t.email ?? "").toLowerCase().includes(q)
    );
  }, [teachers, query]);

  const total = teachers.length;
  // For a school admin every teacher belongs to their school, so "assigned" is
  // the full count and "unassigned" is zero — kept for parity with the design.
  const assigned = total;
  const newThisMonth = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return teachers.filter(
      (t) => t.createdAt && new Date(t.createdAt).getTime() >= start
    ).length;
  }, [teachers]);
  const assignedPct = total ? `${Math.round((assigned / total) * 100)}%` : "0%";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {schoolName} Teachers
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage teaching staff at {schoolName}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-contrast)] transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Teacher
        </button>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Teachers" value={total} icon={GraduationCap} tint="bg-emerald-50 text-emerald-600" />
        <StatCard label="Assigned to School" value={assigned} icon={SchoolIcon} tint="bg-sky-50 text-sky-600" />
        <StatCard label="Unassigned" value={0} icon={UserX} tint="bg-[var(--brand-soft)] text-[var(--brand)]" />
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
            placeholder="Search teachers by name or email…"
            aria-label="Search teachers"
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
          />
        </div>
        <span className="whitespace-nowrap text-sm text-gray-500">
          {filtered.length} of {total} {total === 1 ? "teacher" : "teachers"}
        </span>
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-300">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">Teacher</th>
              <th scope="col" className="px-5 py-3 font-medium">School Assignment</th>
              <th scope="col" className="px-5 py-3 font-medium">Joined</th>
              <th scope="col" className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-sm font-semibold text-[var(--brand-contrast)]">
                      {(t.firstName?.[0] ?? t.email?.[0] ?? "?").toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">
                        {teacherName(t)}
                      </p>
                      <p className="flex items-center gap-1 truncate text-xs text-gray-500">
                        <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {t.email ?? "—"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className="flex items-center gap-1.5 text-gray-700">
                    <SchoolIcon className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                    {schoolName}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-500">{fmtDate(t.createdAt)}</td>
                <td className="px-5 py-3">
                  <StatusPill active={t.active} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-gray-500">
                  {total === 0
                    ? "No teachers yet. Use “Add Teacher” to add the first one."
                    : "No teachers match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Staff overview ──────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-xl border border-gray-200 border-t-[3px] border-t-[var(--brand)] bg-white shadow-sm">
        <div className="bg-gray-900 px-5 py-4">
          <h2 className="text-sm font-bold text-white">Teaching Staff Overview</h2>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-gray-100">
          <OverviewStat label="Total Teachers" value={total} icon={GraduationCap} tint="bg-emerald-50 text-emerald-600" />
          <OverviewStat label="Assigned to School" value={assignedPct} icon={SchoolIcon} tint="bg-sky-50 text-sky-600" accent />
          <OverviewStat label="New This Month" value={newThisMonth} icon={CalendarDays} tint="bg-violet-50 text-violet-600" />
        </dl>
      </section>

      {adding && <AddTeacherModal onClose={() => setAdding(false)} />}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tint: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tint}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </p>
        <p className="text-2xl font-bold leading-tight text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function OverviewStat({
  label,
  value,
  icon: Icon,
  tint,
  accent,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tint: string;
  accent?: boolean;
}) {
  return (
    <div className="px-6 py-6 text-center">
      <span className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <dd className={`text-2xl font-bold leading-none ${accent ? "text-[var(--brand)]" : "text-gray-900"}`}>
        {value}
      </dd>
      <dt className="mt-1.5 text-sm text-gray-600">{label}</dt>
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" aria-hidden="true" />
      Inactive
    </span>
  );
}
