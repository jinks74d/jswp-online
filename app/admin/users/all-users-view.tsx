"use client";

/**
 * Cross-district Users view (super-admin). Stat cards (total / districts /
 * admins / teachers), name/email search with role + district filters, and a
 * table of every user across every district. Provisioning still happens via
 * /admin/districts and /admin/signups, so there is no "Create User" here; the
 * one action offered per row is sending a password reset.
 * Data is fetched server-side; this owns search/filter state.
 */

import { useMemo, useState } from "react";
import {
  Building2,
  Crown,
  GraduationCap,
  Mail,
  Search,
  ShieldCheck,
  Users as UsersIcon,
} from "lucide-react";
import type { AllUserRow } from "@/lib/queries/all-users";
import { StatCard } from "@/components/ui/stat-card";
import { SendResetButton } from "@/components/admin/send-reset-button";

const NO_DISTRICT = "__none__";

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "short" });
const fmtDate = (iso: string | null) =>
  iso ? dateFmt.format(new Date(iso)) : "—";

type RoleMeta = { label: string; badge: string; avatar: string };
const ROLE_META: Record<string, RoleMeta> = {
  super_admin: {
    label: "Super Admin",
    badge: "bg-amber-50 text-amber-700",
    avatar: "bg-amber-100 text-amber-700",
  },
  district_admin: {
    label: "District Admin",
    badge: "bg-violet-50 text-violet-700",
    avatar: "bg-violet-100 text-violet-700",
  },
  school_admin: {
    label: "School Admin",
    badge: "bg-rose-50 text-rose-700",
    avatar: "bg-rose-100 text-rose-700",
  },
  teacher: {
    label: "Teacher",
    badge: "bg-emerald-50 text-emerald-700",
    avatar: "bg-emerald-100 text-emerald-700",
  },
  student: {
    label: "Student",
    badge: "bg-sky-50 text-sky-700",
    avatar: "bg-sky-100 text-sky-700",
  },
};
const roleMeta = (role: string): RoleMeta =>
  ROLE_META[role] ?? {
    label: role,
    badge: "bg-gray-100 text-gray-600",
    avatar: "bg-gray-100 text-gray-600",
  };

const userName = (u: AllUserRow) =>
  [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unnamed user";

export function AllUsersView({
  users,
  districts,
}: {
  users: readonly AllUserRow[];
  districts: readonly string[];
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [district, setDistrict] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const matchesQ =
        !q ||
        userName(u).toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q);
      const matchesRole = role === "all" || u.role === role;
      const matchesDistrict =
        district === "all" ||
        (district === NO_DISTRICT
          ? !u.districtName
          : u.districtName === district);
      return matchesQ && matchesRole && matchesDistrict;
    });
  }, [users, query, role, district]);

  const counts = useMemo(() => {
    let admins = 0;
    let teachers = 0;
    for (const u of users) {
      if (
        u.role === "super_admin" ||
        u.role === "district_admin" ||
        u.role === "school_admin"
      )
        admins++;
      else if (u.role === "teacher") teachers++;
    }
    return { total: users.length, districts: districts.length, admins, teachers };
  }, [users, districts]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="mt-1 text-sm text-gray-600">
          Every user across every district. Read-only — provision users from{" "}
          <span className="font-medium">Districts</span> and{" "}
          <span className="font-medium">Signup requests</span>.
        </p>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Users" value={counts.total} icon={UsersIcon} tint="bg-rose-50 text-rose-600" />
        <StatCard label="Districts" value={counts.districts} icon={Building2} tint="bg-violet-50 text-violet-600" />
        <StatCard label="Admins" value={counts.admins} icon={ShieldCheck} tint="bg-amber-50 text-amber-600" />
        <StatCard label="Teachers" value={counts.teachers} icon={GraduationCap} tint="bg-emerald-50 text-emerald-600" />
      </div>

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            aria-label="Search users"
            className="w-full rounded-lg border border-gray-500 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          aria-label="Filter by role"
          className={selectClass}
        >
          <option value="all">All Roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="district_admin">District Admin</option>
          <option value="school_admin">School Admin</option>
          <option value="teacher">Teacher</option>
          <option value="student">Student</option>
        </select>
        <select
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          aria-label="Filter by district"
          className={selectClass}
        >
          <option value="all">All Districts</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
          <option value={NO_DISTRICT}>No district (super admins)</option>
        </select>
        <span className="whitespace-nowrap text-sm text-gray-500">
          {filtered.length} of {users.length}{" "}
          {users.length === 1 ? "user" : "users"}
        </span>
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-300">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">User</th>
              <th scope="col" className="px-5 py-3 font-medium">Role</th>
              <th scope="col" className="px-5 py-3 font-medium">District</th>
              <th scope="col" className="px-5 py-3 font-medium">School</th>
              <th scope="col" className="px-5 py-3 font-medium">Created</th>
              <th scope="col" className="px-5 py-3 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((u) => {
              const meta = roleMeta(u.role);
              return (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${meta.avatar}`}
                      >
                        {(u.firstName?.[0] ?? u.email?.[0] ?? "?").toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">
                          {userName(u)}
                        </p>
                        <p className="flex items-center gap-1 truncate text-xs text-gray-500">
                          <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                          {u.email ?? "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${meta.badge}`}
                    >
                      {u.role === "super_admin" && (
                        <Crown className="h-3 w-3" aria-hidden="true" />
                      )}
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={u.districtName ? "text-gray-700" : "text-gray-500"}>
                      {u.districtName ?? "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={u.schoolName ? "text-gray-700" : "text-gray-500"}>
                      {u.schoolName ?? "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {fmtDate(u.createdAt)}
                  </td>
                  <td className="px-5 py-3">
                    {u.email && (
                      <SendResetButton userId={u.id} userLabel={userName(u)} />
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-gray-500">
                  No users match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const selectClass =
  "rounded-lg border border-gray-500 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500";

