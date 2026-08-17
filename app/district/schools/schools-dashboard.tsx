"use client";

/**
 * District-admin Schools dashboard UI. A live-filtered grid of school cards
 * (icon, name, added date, address, user count, View Details / Manage Users)
 * with a header "+ Add School" toggle that reveals the create form, and a
 * district summary (total schools, total users, avg users per school). Data is
 * fetched server-side and passed in; this component owns search + add-panel
 * state only.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Plus,
  School as SchoolIcon,
  Search,
  Users,
  X,
} from "lucide-react";
import { SchoolForm } from "@/components/school-structure/school-form";

export type SchoolCard = {
  id: string;
  name: string;
  address: string | null;
  active: boolean;
  userCount: number;
  /** Pre-formatted on the server to avoid locale drift. */
  addedLabel: string;
};

export function SchoolsDashboard({
  districtId,
  districtName,
  schools,
}: {
  districtId: string;
  districtName: string;
  schools: readonly SchoolCard[];
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.address ?? "").toLowerCase().includes(q)
    );
  }, [query, schools]);

  const totalUsers = schools.reduce((sum, s) => sum + s.userCount, 0);
  const avgUsers = schools.length
    ? Math.round(totalUsers / schools.length)
    : 0;

  const detailHref = (id: string) => `/district/schools/${id}`;

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schools</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage schools in {districtName}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          aria-expanded={adding}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-contrast)] transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
        >
          {adding ? (
            <X className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4" aria-hidden="true" />
          )}
          {adding ? "Close" : "Add School"}
        </button>
      </div>

      {/* ── Add panel ───────────────────────────────────────────────── */}
      {adding && (
        <div className="max-w-xl">
          <SchoolForm mode="create" districtId={districtId} />
        </div>
      )}

      {/* ── Search ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search schools…"
            aria-label="Search schools"
            className="w-full rounded-lg border border-gray-400 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
          />
        </div>
        <span className="whitespace-nowrap text-sm text-gray-500">
          {filtered.length} of {schools.length}{" "}
          {schools.length === 1 ? "school" : "schools"}
        </span>
      </div>

      {/* ── Cards ───────────────────────────────────────────────────── */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-3.5 p-5 pb-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
                  <SchoolIcon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-bold leading-tight text-gray-900">
                    {s.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Added {s.addedLabel}
                  </p>
                </div>
                {!s.active && (
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                    Inactive
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2.5 px-5 pb-4 text-sm text-gray-600">
                <div className="flex items-start gap-2.5">
                  <MapPin
                    className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]"
                    aria-hidden="true"
                  />
                  <span className={s.address ? "" : "text-gray-500"}>
                    {s.address ?? "No address yet"}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Users
                    className="h-4 w-4 shrink-0 text-[var(--brand)]"
                    aria-hidden="true"
                  />
                  <span>
                    {s.userCount} {s.userCount === 1 ? "user" : "users"}
                  </span>
                </div>
              </div>

              <div className="flex gap-2.5 border-t border-gray-100 p-4">
                <Link
                  href={detailHref(s.id)}
                  className="flex flex-1 items-center justify-center rounded-lg bg-[var(--brand-soft)] px-3 py-2 text-sm font-semibold text-[var(--brand)] transition-colors hover:bg-[var(--brand-soft-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
                >
                  View Details
                </Link>
                <Link
                  href={`${detailHref(s.id)}#manage`}
                  className="flex flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
                >
                  Manage Users
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
          {schools.length === 0
            ? "No schools yet. Use “Add School” to create the first one."
            : `No schools match “${query}”.`}
        </div>
      )}

      {/* ── District summary ────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            District Summary
          </h2>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-gray-100">
          <SummaryStat label="Total Schools" value={schools.length} />
          <SummaryStat label="Total Users" value={totalUsers} accent />
          <SummaryStat label="Avg Users per School" value={avgUsers} />
        </dl>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="px-6 py-6 text-center">
      <dd
        className={`text-4xl font-bold leading-none ${
          accent ? "text-[var(--brand)]" : "text-gray-900"
        }`}
      >
        {value}
      </dd>
      <dt className="mt-2 text-sm text-gray-600">{label}</dt>
    </div>
  );
}
