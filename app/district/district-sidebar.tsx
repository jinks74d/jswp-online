"use client";

/**
 * District-admin sidebar shell. Brand + district name, primary nav (active
 * route highlighted via usePathname), a Quick Actions group, and a user footer
 * with sign-out. Sections without pages yet are marked disabled ("Soon").
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  LayoutDashboard,
  Plus,
  School,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Routes not built yet render disabled with a "Soon" pill. */
  ready?: boolean;
};

const NAV: readonly NavItem[] = [
  { href: "/district", label: "Dashboard", icon: LayoutDashboard, ready: true },
  { href: "/district/schools", label: "Schools", icon: School, ready: true },
  { href: "/district/classes", label: "Classes", icon: BookOpen, ready: true },
  { href: "/district/users", label: "Users", icon: Users, ready: true },
  { href: "/district/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/district/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/district/settings", label: "Settings", icon: Settings },
];

export function DistrictSidebar({
  districtName,
  userName,
}: {
  districtName: string;
  userName: string;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/district"
      ? pathname === "/district"
      : pathname === href || pathname.startsWith(`${href}/`);

  const initials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "D";

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
      {/* Brand */}
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)] text-[var(--brand-contrast)]">
            <BookOpen className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold text-gray-900">
              Jane Schaffer
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Academic Writing Program®
            </span>
          </span>
        </div>
        <p className="mt-2 truncate text-xs text-gray-500">{districtName}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3.5">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            if (!item.ready) {
              return (
                <li key={item.href}>
                  <span
                    aria-disabled="true"
                    className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-300"
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    {item.label}
                    <span className="ml-auto rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">
                      Soon
                    </span>
                  </span>
                </li>
              );
            }
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${
                    active
                      ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="px-3 pb-2 pt-5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
          Quick Actions
        </p>
        <Link
          href="/district/schools"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
        >
          <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
          Add School
        </Link>
      </nav>

      {/* User */}
      <div className="border-t border-gray-100 px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
            {initials}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold text-gray-900">
              {userName}
            </span>
            <span className="block text-xs text-gray-500">District Admin</span>
          </span>
        </div>
        <LogoutButton className="mt-3.5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand)] hover:opacity-80 disabled:opacity-50">
          Sign Out
        </LogoutButton>
      </div>
    </aside>
  );
}
