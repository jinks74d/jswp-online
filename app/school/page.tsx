/**
 * /school — school-admin dashboard home. Stat cards (teachers / students /
 * classes / assignments), a Recent Users feed, a School Performance panel, and
 * quick actions, all scoped to the admin's school. The mockup's trend deltas
 * and the analytics tile values are omitted — no historical/usage series yet.
 */

import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  GraduationCap,
  Plus,
  Users as UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getSchool } from "@/lib/queries/schools";
import {
  getSchoolStats,
  listRecentSchoolUsers,
  type RecentSchoolUser,
} from "@/lib/queries/school-dashboard";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "short" });
const fmtDate = (iso: string | null) =>
  iso ? dateFmt.format(new Date(iso)) : "—";

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export default async function SchoolDashboardPage() {
  const profile = await requireRole("school_admin");
  if (!profile.school_id) {
    return (
      <p className="text-sm text-gray-500">
        Your account isn’t linked to a school yet.
      </p>
    );
  }

  const now = new Date();
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  ).toISOString();

  const [school, stats, users] = await Promise.all([
    getSchool(profile.school_id),
    getSchoolStats(profile.school_id, monthStart),
    listRecentSchoolUsers(profile.school_id, 4),
  ]);

  const firstName = profile.first_name || "there";
  const schoolName = school?.name ?? "your school";
  const activeUsers = stats.teachers + stats.students;
  const ratio =
    stats.teachers === 0
      ? "—"
      : (() => {
          const d = gcd(stats.teachers, stats.students || stats.teachers);
          return `${stats.teachers / d}:${(stats.students || 0) / d}`;
        })();

  const cards: { label: string; value: number; icon: LucideIcon; tint: string }[] =
    [
      { label: "Teachers", value: stats.teachers, icon: GraduationCap, tint: "bg-emerald-50 text-emerald-600" },
      { label: "Students", value: stats.students, icon: UsersIcon, tint: "bg-sky-50 text-sky-600" },
      { label: "Classes", value: stats.classes, icon: BookOpen, tint: "bg-violet-50 text-violet-600" },
      { label: "Assignments", value: stats.assignments, icon: ClipboardList, tint: "bg-[var(--brand-soft)] text-[var(--brand)]" },
    ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">School Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Welcome back, {firstName} — managing {schoolName}.
          </p>
        </div>
        <div className="flex shrink-0 gap-2.5">
          <Link
            href="/school/teachers"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--brand)] transition-colors hover:bg-[var(--brand-soft-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Teacher
          </Link>
          <Link
            href="/school/classes"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-contrast)] transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Create Class
          </Link>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.tint}`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <dt className="mt-3.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {c.label}
              </dt>
              <dd className="mt-0.5 text-3xl font-bold text-gray-900">
                {c.value}
              </dd>
            </div>
          );
        })}
      </dl>

      {/* ── Recent users + performance ──────────────────────────────── */}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-bold text-gray-900">Recent Users</h2>
            <Link
              href="/school/teachers"
              className="text-sm font-semibold text-[var(--brand)] hover:opacity-80"
            >
              Manage all
            </Link>
          </div>
          {users.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {users.map((u) => {
                const meta = roleMeta(u.role);
                return (
                  <li key={u.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${meta.avatar}`}
                    >
                      {(u.firstName?.[0] ?? "?").toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {userName(u)}
                      </p>
                      <p className={`text-xs font-medium ${meta.text}`}>
                        {meta.label}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">
                      {fmtDate(u.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-gray-400">
              No teachers or students yet.
            </p>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-bold text-gray-900">
              School Performance
            </h2>
          </div>
          <div className="px-5">
            <PerfRow
              label="Teacher to Student Ratio"
              sub="Current staffing levels"
              value={ratio}
              unit="teacher:students"
              accent="text-[var(--brand)]"
            />
            <PerfRow
              label="Active Users"
              sub="Total school community"
              value={activeUsers}
              unit="total users"
              accent="text-emerald-600"
            />
            <PerfRow
              label="Growth This Month"
              sub="New additions"
              value={`+${stats.growth}`}
              unit="new users"
              accent="text-amber-600"
              last
            />
          </div>
        </section>
      </div>

      {/* ── Quick actions ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-gray-900">Quick Actions</h2>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          <QuickAction href="/school/teachers" icon={UsersIcon} title="Manage Users" desc="View teachers and students" />
          <QuickAction href="/school/teachers" icon={GraduationCap} title="Add Teachers" desc="Invite new teaching staff" />
          <QuickAction href="/school/classes" icon={BookOpen} title="View Classes" desc="Monitor school classes" />
          <QuickAction href="/school/assignments" icon={ClipboardList} title="View Assignments" desc="Monitor school assignments" />
          <QuickAction href="/school/analytics" icon={BarChart3} title="View Analytics" desc="Track school performance" />
        </div>
      </div>
    </div>
  );
}

/* ── Presentational helpers ───────────────────────────────────────────── */

function PerfRow({
  label,
  sub,
  value,
  unit,
  accent,
  last,
}: {
  label: string;
  sub: string;
  value: string | number;
  unit: string;
  accent: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-4 ${
        last ? "" : "border-b border-gray-100"
      }`}
    >
      <div>
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="mt-0.5 text-xs text-gray-400">{sub}</p>
      </div>
      <div className="text-right">
        <p className={`text-2xl font-bold ${accent}`}>{value}</p>
        <p className="text-[11px] text-gray-400">{unit}</p>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
    >
      <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className="block text-sm font-semibold text-gray-900">{title}</span>
      <span className="mt-0.5 block text-xs text-gray-500">{desc}</span>
    </Link>
  );
}

const ROLE_META: Record<
  string,
  { label: string; text: string; avatar: string }
> = {
  teacher: {
    label: "Teacher",
    text: "text-emerald-700",
    avatar: "bg-emerald-100 text-emerald-700",
  },
  student: {
    label: "Student",
    text: "text-sky-700",
    avatar: "bg-sky-100 text-sky-700",
  },
};
const roleMeta = (role: string) =>
  ROLE_META[role] ?? {
    label: role,
    text: "text-gray-600",
    avatar: "bg-gray-100 text-gray-600",
  };

function userName(u: RecentSchoolUser): string {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unnamed user";
}
