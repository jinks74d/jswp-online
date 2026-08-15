"use client";

/**
 * Left rail with the v2 nav items. Active state matches by route
 * prefix (so /dashboard/classes/123 still highlights "My Classes"). On
 * desktop it's a fixed-position rail (always visible). On phones it
 * slides in from the left over a backdrop; backdrop click closes it.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FileText, GraduationCap } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard/classes", label: "My Classes", icon: BookOpen },
  { href: "/dashboard/assignments", label: "My Assignments", icon: FileText },
  { href: "/dashboard/students", label: "My Students", icon: GraduationCap },
] as const;

export function TeacherSidebar({
  mobileOpen,
  onClose,
  brandName,
}: {
  mobileOpen: boolean;
  onClose: () => void;
  brandName: string;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop — mobile only, only when open */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-800 border-r border-slate-900 shadow-lg transform transition-transform duration-200 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link
          href="/dashboard"
          onClick={onClose}
          className="flex h-16 items-center border-b border-slate-700 px-4 text-lg font-semibold tracking-tight text-white truncate"
        >
          {brandName}
        </Link>
        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors border-l-2 ${
                  active
                    ? "bg-slate-700 text-white"
                    : "border-transparent text-slate-300 hover:text-white hover:bg-slate-700/50"
                }`}
                style={
                  active
                    ? { borderLeftColor: "var(--brand)" }
                    : undefined
                }
              >
                <Icon
                  aria-hidden="true"
                  className="w-5 h-5"
                  style={
                    active
                      ? { color: "var(--brand)" }
                      : { color: "currentColor" }
                  }
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
