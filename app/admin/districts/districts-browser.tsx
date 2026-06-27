"use client";

/**
 * Client-side search + sort over the district cards, plus the branded
 * "tenant card" grid. The server hands us the full list (super admins see
 * every district); filtering/sorting is cheap and local so the toolbar feels
 * instant. Each card is a single Link to the district detail page.
 *
 * §9: every colour-coded signal (brand band, status dot) is paired with a
 * text/shape signal so colour is never the only cue.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { School, Search, Users } from "lucide-react";
import type { DistrictCard } from "@/lib/queries/districts";
import { getContrastColor } from "@/lib/district-branding.utils";
import { isValidHexColor } from "@/lib/district-branding.types";

type SortKey = "name" | "newest" | "schools";

const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: "name", label: "Name A–Z" },
  { value: "newest", label: "Newest" },
  { value: "schools", label: "Most schools" },
];

export function DistrictsBrowser({
  districts,
}: {
  districts: readonly DistrictCard[];
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? districts.filter(
          (d) =>
            d.name.toLowerCase().includes(needle) ||
            (d.subdomain?.toLowerCase().includes(needle) ?? false)
        )
      : districts.slice();

    const sorted = filtered.slice();
    switch (sort) {
      case "newest":
        sorted.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case "schools":
        sorted.sort((a, b) => b.school_count - a.school_count);
        break;
      case "name":
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return sorted;
  }, [districts, query, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or subdomain"
            aria-label="Search districts by name or subdomain"
            className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="district-sort"
            className="text-sm font-medium text-gray-600"
          >
            Sort
          </label>
          <select
            id="district-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {districts.length === 0 ? (
        <EmptyCard
          heading="No districts yet."
          body="Create your first district to begin onboarding its schools and admins."
        />
      ) : visible.length === 0 ? (
        <EmptyCard
          heading={`No districts match “${query.trim()}”.`}
          body="Try a different name or subdomain."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((d) => (
            <li key={d.id}>
              <DistrictTenantCard district={d} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────── */

function DistrictTenantCard({ district }: { district: DistrictCard }) {
  const primary =
    district.primary_color && isValidHexColor(district.primary_color)
      ? district.primary_color
      : null;
  const secondary =
    district.secondary_color && isValidHexColor(district.secondary_color)
      ? district.secondary_color
      : null;
  const onPrimary = primary ? getContrastColor(primary) : undefined;
  const initials = getInitials(district.name);

  return (
    <Link
      href={`/admin/districts/${district.id}`}
      aria-label={`Manage ${district.name}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      {/* Brand band: district primary colour or a neutral slate fallback. */}
      <div
        className={`flex h-20 items-center justify-center ${
          primary ? "" : "bg-slate-600"
        }`}
        style={primary ? { backgroundColor: primary } : undefined}
      >
        {district.logo_url ? (
          <span className="flex h-14 items-center rounded-md bg-white/95 px-3 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={district.logo_url}
              alt=""
              className="block h-9 w-auto max-w-[160px] object-contain"
            />
          </span>
        ) : (
          <span
            className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/20 text-lg font-bold"
            style={{ color: onPrimary ?? "#ffffff" }}
            aria-hidden="true"
          >
            {initials}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-base font-semibold text-gray-900">
            {district.name}
          </h3>
          <StatusPill active={district.active} />
        </div>

        {district.subdomain ? (
          <span className="inline-flex w-fit max-w-full items-center truncate rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600">
            {district.subdomain}.jswponline.com
          </span>
        ) : (
          <span className="text-xs text-gray-400">No subdomain</span>
        )}

        <dl className="mt-auto flex items-center gap-4 pt-1 text-sm text-gray-600">
          <div className="flex items-center gap-1.5">
            <School className="h-4 w-4 text-gray-400" aria-hidden="true" />
            <dt className="sr-only">Schools</dt>
            <dd>{pluralize(district.school_count, "school")}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-gray-400" aria-hidden="true" />
            <dt className="sr-only">District admins</dt>
            <dd>{pluralize(district.admin_count, "admin")}</dd>
          </div>
        </dl>
      </div>

      {/* Secondary-colour accent stripe — echoes the detail-page banner. */}
      {secondary && (
        <div
          className="h-1.5 w-full"
          style={{ backgroundColor: secondary }}
          aria-hidden="true"
        />
      )}
    </Link>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        active
          ? "bg-green-50 text-green-700"
          : "bg-gray-100 text-gray-500"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          active
            ? "bg-green-500"
            : "border border-gray-400 bg-transparent"
        }`}
        aria-hidden="true"
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function EmptyCard({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
      <p className="text-sm font-semibold text-gray-900">{heading}</p>
      <p className="mt-1 text-sm text-gray-500">{body}</p>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

/** First letters of up to two words, uppercased. Falls back to "?". */
function getInitials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase();
  return letters || "?";
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
