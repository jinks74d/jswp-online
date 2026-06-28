"use client";

/**
 * School Classes view. Stat cards (classes / subjects / periods), search +
 * subject filter, and class periods grouped by subject as cards. "Create Class"
 * opens a modal. Bulk upload and per-card edit/delete are intentionally omitted
 * for now (no delete action yet; bulk upload is a separate flow).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  Clock,
  Layers,
  Plus,
  Search,
  Users,
} from "lucide-react";
import type {
  SchoolClassStats,
  SchoolPeriodRow,
} from "@/lib/queries/school-classes";
import { CreateClassModal } from "./create-class-modal";

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "short" });
const fmtDate = (iso: string | null) =>
  iso ? dateFmt.format(new Date(iso)) : "—";

export function ClassesView({
  schoolId,
  districtId,
  stats,
  periods,
  subjects,
}: {
  schoolId: string;
  districtId: string;
  stats: SchoolClassStats;
  periods: readonly SchoolPeriodRow[];
  /** Existing subject names at the school, for the Create Class dropdown. */
  subjects: readonly string[];
}) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("all");
  const [creating, setCreating] = useState(false);

  // Subjects in first-seen order, for the filter dropdown + group ordering.
  const subjectOrder = useMemo(() => {
    const seen: string[] = [];
    for (const p of periods) if (!seen.includes(p.subjectName)) seen.push(p.subjectName);
    return seen;
  }, [periods]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return periods.filter(
      (p) =>
        (!q ||
          [p.className, p.subjectName, p.periodLabel]
            .join(" ")
            .toLowerCase()
            .includes(q)) &&
        (subject === "all" || p.subjectName === subject)
    );
  }, [periods, query, subject]);

  const groups = useMemo(
    () =>
      subjectOrder
        .map((subj) => ({
          subject: subj,
          classes: filtered.filter((p) => p.subjectName === subj),
        }))
        .filter((g) => g.classes.length > 0),
    [subjectOrder, filtered]
  );

  const detailHref = (p: SchoolPeriodRow) =>
    `/admin/districts/${districtId}/schools/${schoolId}/subjects/${p.subjectId}/classes/${p.classId}/periods/${p.id}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage class periods and schedules at your school
        </p>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Classes" value={stats.classes} icon={BookOpen} tint="bg-[var(--brand-soft)] text-[var(--brand)]" />
        <StatCard label="Subjects" value={stats.subjects} icon={Layers} tint="bg-emerald-50 text-emerald-600" />
        <StatCard label="Periods" value={stats.periods} icon={Clock} tint="bg-violet-50 text-violet-600" />
      </div>

      {/* ── Section header ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Class Periods</h2>
          <p className="mt-0.5 text-sm text-gray-400">
            {filtered.length} of {periods.length} class{" "}
            {periods.length === 1 ? "period" : "periods"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-contrast)] transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Class
        </button>
      </div>

      {/* ── Search + subject filter ─────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search classes, subjects, or periods…"
            aria-label="Search classes"
            className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
          />
        </div>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          aria-label="Filter by subject"
          className="rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] sm:min-w-[180px]"
        >
          <option value="all">All Subjects</option>
          {subjectOrder.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* ── Subject groups ──────────────────────────────────────────── */}
      {groups.length > 0 ? (
        <div className="space-y-5">
          {groups.map((g) => (
            <section
              key={g.subject}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between gap-3 bg-gray-900 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand)]" aria-hidden="true" />
                  <h3 className="text-base font-bold text-white">{g.subject}</h3>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gray-300">
                  {g.classes.length} class{" "}
                  {g.classes.length === 1 ? "period" : "periods"}
                </span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-5">
                {g.classes.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col overflow-hidden rounded-xl border border-gray-200 border-t-[3px] border-t-[var(--brand)] transition-shadow hover:shadow-sm"
                  >
                    <div className="flex-1 p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)] text-[var(--brand-contrast)]">
                          <BookOpen className="h-[18px] w-[18px]" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-gray-900">
                            {p.className}
                          </p>
                          <p className="truncate text-xs text-gray-400">
                            {p.periodLabel}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1.5 text-xs text-gray-600">
                        <p className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                          Created {fmtDate(p.createdAt)}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                          {p.enrolled} student{p.enrolled === 1 ? "" : "s"} enrolled
                        </p>
                      </div>
                    </div>
                    <Link
                      href={detailHref(p)}
                      className="border-t border-gray-100 bg-[var(--brand-soft)] px-4 py-3 text-sm font-semibold text-[var(--brand)] transition-colors hover:bg-[var(--brand-soft-strong)] focus:outline-none focus-visible:bg-[var(--brand-soft-strong)]"
                    >
                      View Details →
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
          {periods.length === 0
            ? "No classes yet. Use “Create Class” to add the first one."
            : "No classes match your filters."}
        </div>
      )}

      {creating && (
        <CreateClassModal
          schoolId={schoolId}
          subjects={subjects}
          onClose={() => setCreating(false)}
        />
      )}
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
  icon: typeof BookOpen;
  tint: string;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tint}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </p>
        <p className="text-2xl font-bold leading-tight text-gray-900">{value}</p>
      </div>
    </div>
  );
}
