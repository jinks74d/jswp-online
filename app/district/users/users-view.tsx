"use client";

/**
 * District Users view. Stat cards (total / district admins / school admins /
 * teachers), name/email search with role + school filters, and a table of
 * every user in the district. "Create User" opens a modal (School Admin /
 * Teacher). Data is fetched server-side; this owns search/filter state.
 */

import { useMemo, useState } from "react";
import {
  GraduationCap,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
  Users as UsersIcon,
} from "lucide-react";
import type { DistrictUserRow } from "@/lib/queries/district-users";
import { StatCard } from "@/components/ui/stat-card";
import { SendResetButton } from "@/components/admin/send-reset-button";
import { CreateUserModal, type SchoolOption } from "./create-user-modal";

const NO_SCHOOL = "__none__";

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "short" });
const fmtDate = (iso: string | null) =>
  iso ? dateFmt.format(new Date(iso)) : "—";

type RoleMeta = { label: string; badge: string; avatar: string };
const ROLE_META: Record<string, RoleMeta> = {
  district_admin: {
    label: "District Admin",
    badge: "bg-violet-50 text-violet-700",
    avatar: "bg-violet-100 text-violet-700",
  },
  school_admin: {
    label: "School Admin",
    badge: "bg-[var(--brand-soft)] text-[var(--brand)]",
    avatar: "bg-[var(--brand-soft-strong)] text-[var(--brand)]",
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

const userName = (u: DistrictUserRow) =>
  [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unnamed user";

export function UsersView({
  users,
  schools,
}: {
  users: readonly DistrictUserRow[];
  schools: readonly SchoolOption[];
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [school, setSchool] = useState("all");
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const matchesQ =
        !q ||
        userName(u).toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q);
      const matchesRole = role === "all" || u.role === role;
      const matchesSchool =
        school === "all" ||
        (school === NO_SCHOOL ? !u.schoolName : u.schoolName === school);
      return matchesQ && matchesRole && matchesSchool;
    });
  }, [users, query, role, school]);

  const counts = useMemo(() => {
    let districtAdmins = 0;
    let schoolAdmins = 0;
    let teachers = 0;
    for (const u of users) {
      if (u.role === "district_admin") districtAdmins++;
      else if (u.role === "school_admin") schoolAdmins++;
      else if (u.role === "teacher") teachers++;
    }
    return { total: users.length, districtAdmins, schoolAdmins, teachers };
  }, [users]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage users across your district
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-contrast)] transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create User
        </button>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Users" value={counts.total} icon={UsersIcon} tint="bg-[var(--brand-soft)] text-[var(--brand)]" />
        <StatCard label="District Admins" value={counts.districtAdmins} icon={ShieldCheck} tint="bg-violet-50 text-violet-600" />
        <StatCard label="School Admins" value={counts.schoolAdmins} icon={UserCog} tint="bg-sky-50 text-sky-600" />
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
            className="w-full rounded-lg border border-gray-500 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          aria-label="Filter by role"
          className={selectClass}
        >
          <option value="all">All Roles</option>
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
          <option value="school_admin">School Admin</option>
          <option value="district_admin">District Admin</option>
        </select>
        <select
          value={school}
          onChange={(e) => setSchool(e.target.value)}
          aria-label="Filter by school"
          className={selectClass}
        >
          <option value="all">All Schools</option>
          {schools.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
          <option value={NO_SCHOOL}>No school assigned</option>
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
                      className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${meta.badge}`}
                    >
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={u.schoolName ? "text-gray-700" : "text-gray-500"}>
                      {u.schoolName ?? "No school assigned"}
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
                <td colSpan={5} className="px-5 py-12 text-center text-gray-500">
                  No users match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {creating && (
        <CreateUserModal schools={schools} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}

const selectClass =
  "rounded-lg border border-gray-500 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]";

