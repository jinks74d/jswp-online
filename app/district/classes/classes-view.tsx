"use client";

/**
 * District Classes view. Three stat cards (classes / subjects / periods), a
 * searchable list of every class period in the district, and an empty state.
 * Class creation lives under a school's subject structure, so "Create Class"
 * routes into the Schools area. Data is fetched server-side; this owns search.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  Clock,
  Layers,
  Plus,
  Search,
  Users,
} from "lucide-react";
import type {
  DistrictClassStats,
  DistrictPeriodRow,
} from "@/lib/queries/district-classes";
import { CreateClassModal, type SchoolOption } from "./create-class-modal";

export function ClassesView({
  stats,
  periods,
  schools,
}: {
  stats: DistrictClassStats;
  periods: readonly DistrictPeriodRow[];
  schools: readonly SchoolOption[];
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return periods;
    return periods.filter((p) =>
      [p.className, p.subjectName, p.schoolName, p.periodLabel]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query, periods]);

  const detailHref = (p: DistrictPeriodRow) =>
    `/district/schools/${p.schoolId}/subjects/${p.subjectId}/classes/${p.classId}/periods/${p.id}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage class periods and schedules across your district
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Class
        </button>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Classes"
          value={stats.classes}
          icon={BookOpen}
          tint="bg-rose-50 text-rose-600"
        />
        <StatCard
          label="Subjects"
          value={stats.subjects}
          icon={Layers}
          tint="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Periods"
          value={stats.periods}
          icon={Clock}
          tint="bg-violet-50 text-violet-600"
        />
      </div>

      {periods.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <>
          {/* ── Section header ──────────────────────────────────────── */}
          <div>
            <h2 className="text-lg font-bold text-gray-900">Class Periods</h2>
            <p className="mt-0.5 text-sm text-gray-400">
              {filtered.length} of {periods.length} class{" "}
              {periods.length === 1 ? "period" : "periods"}
            </p>
          </div>

          {/* ── Search ──────────────────────────────────────────────── */}
          <div className="relative">
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
              className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          {/* ── List ────────────────────────────────────────────────── */}
          {filtered.length > 0 ? (
            <ul className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              {filtered.map((p) => (
                <li key={p.id} className="border-b border-gray-100 last:border-b-0">
                  <Link
                    href={detailHref(p)}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                      <BookOpen className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {p.className}
                        <span className="ml-2 font-normal text-gray-400">
                          {p.periodLabel}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {p.subjectName} · {p.schoolName}
                        {p.academicYear ? ` · ${p.academicYear}` : ""}
                      </p>
                    </div>
                    <span className="hidden items-center gap-1.5 text-sm text-gray-500 sm:flex">
                      <Users className="h-4 w-4 text-gray-400" aria-hidden="true" />
                      {p.enrolled}
                    </span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-gray-300"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
              No class periods match “{query}”.
            </div>
          )}
        </>
      )}

      {creating && (
        <CreateClassModal
          schools={schools}
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
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tint}`}
      >
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

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <BookOpen className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-bold text-gray-900">No classes yet</h2>
      <p className="mt-1.5 text-sm text-gray-600">
        Get started by creating your first class period.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Create First Class
      </button>
    </div>
  );
}
