/**
 * /district — District-admin dashboard home. Four headline stat cards, a
 * two-column Recent Schools / Recent Users feed, and a Quick Actions card.
 * All counts are RLS-scoped to the admin's own district. The mockup's trend
 * deltas (+12% …) are intentionally omitted — there is no historical series
 * to compute them from yet.
 */

import Link from "next/link";
import {
  GraduationCap,
  School as SchoolIcon,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getDistrict } from "@/lib/queries/districts";
import {
  getDistrictStats,
  listRecentSchools,
  listRecentUsers,
  type RecentUser,
} from "@/lib/queries/district-dashboard";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "short" });
const fmtDate = (iso: string | null) =>
  iso ? dateFmt.format(new Date(iso)) : "—";

export default async function DistrictDashboardPage() {
  const profile = await requireRole("district_admin");
  const districtId = profile.district_id;
  if (!districtId) {
    return (
      <p className="text-sm text-gray-500">
        Your account isn’t linked to a district yet.
      </p>
    );
  }

  const [district, stats, schools, users] = await Promise.all([
    getDistrict(districtId),
    getDistrictStats(districtId),
    listRecentSchools(districtId, 5),
    listRecentUsers(districtId, 5),
  ]);

  const firstName = profile.first_name || "there";
  const districtName = district?.name ?? "your district";

  const cards: { label: string; value: number; icon: LucideIcon; tint: string }[] =
    [
      { label: "Schools", value: stats.schools, icon: SchoolIcon, tint: "bg-sky-50 text-sky-600" },
      { label: "Administrators", value: stats.administrators, icon: UserCog, tint: "bg-violet-50 text-violet-600" },
      { label: "Teachers", value: stats.teachers, icon: GraduationCap, tint: "bg-emerald-50 text-emerald-600" },
      { label: "Students", value: stats.students, icon: Users, tint: "bg-rose-50 text-rose-600" },
    ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">District Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back, {firstName} — here’s what’s happening in {districtName}.
        </p>
      </header>

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

      {/* ── Recent schools + users ──────────────────────────────────── */}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Panel title="Recent Schools" viewAllHref="/district/schools">
          {schools.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {schools.map((s) => (
                <li key={s.id} className="flex items-start gap-3 px-5 py-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                    <SchoolIcon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {s.name}
                    </p>
                    <p className="truncate text-xs text-gray-400">
                      {s.address ?? "No address yet"}
                    </p>
                  </div>
                  <span className="shrink-0 text-right text-xs text-gray-400">
                    Added
                    <br />
                    {fmtDate(s.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No schools yet.</Empty>
          )}
        </Panel>

        <Panel title="Recent Users" viewAllHref="/district/users">
          {users.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {users.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                    {userInitial(u)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {userName(u)}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <RoleBadge role={u.role} />
                      <span className="truncate text-xs text-gray-400">
                        {u.school_name ?? "District"}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 text-right text-xs text-gray-400">
                    Joined
                    <br />
                    {fmtDate(u.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No users yet.</Empty>
          )}
        </Panel>
      </div>

      {/* ── Quick actions ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-gray-900">Quick Actions</h2>
        <div className="grid gap-3.5 sm:grid-cols-3">
          <QuickAction
            href="/district/schools"
            icon={SchoolIcon}
            title="Add School"
            desc="Create a new school in your district"
          />
          <QuickAction
            href="/district/users"
            icon={Users}
            title="Invite Users"
            desc="Add teachers, admins, or students"
          />
          <QuickAction
            href="/district/assignments"
            icon={GraduationCap}
            title="View Assignments"
            desc="Monitor district-wide assignments"
          />
        </div>
      </div>
    </div>
  );
}

/* ── Presentational helpers ───────────────────────────────────────────── */

function Panel({
  title,
  viewAllHref,
  children,
}: {
  title: string;
  viewAllHref: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        <Link
          href={viewAllHref}
          className="text-sm font-semibold text-rose-600 hover:text-rose-700"
        >
          View all
        </Link>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-5 py-8 text-center text-sm text-gray-400">{children}</p>
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
      className="flex items-start gap-3 rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-gray-900">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-gray-500">{desc}</span>
      </span>
    </Link>
  );
}

const ROLE_BADGE: Record<string, string> = {
  student: "bg-sky-50 text-sky-700",
  teacher: "bg-emerald-50 text-emerald-700",
  school_admin: "bg-violet-50 text-violet-700",
  district_admin: "bg-rose-50 text-rose-700",
};

const ROLE_LABEL: Record<string, string> = {
  student: "student",
  teacher: "teacher",
  school_admin: "school admin",
  district_admin: "district admin",
};

function RoleBadge({ role }: { role: string }) {
  const cls = ROLE_BADGE[role] ?? "bg-gray-100 text-gray-600";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}
    >
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}

function userName(u: RecentUser): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || "Unnamed user";
}

function userInitial(u: RecentUser): string {
  return (u.first_name?.[0] ?? u.last_name?.[0] ?? "?").toUpperCase();
}
