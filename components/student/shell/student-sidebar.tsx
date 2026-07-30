"use client";

/**
 * Left rail with the (single) student nav item. More items will land
 * as later chunks ship (Portfolio, Drafts, Settings). On desktop the
 * rail is fixed; on phones it slides in from the left over a backdrop.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText } from "lucide-react";

const NAV_ITEMS = [
  { href: "/student/assignments", label: "My Assignments", icon: FileText },
] as const;

export function StudentSidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 border-b border-gray-200" aria-hidden="true" />
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
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-gray-100 text-gray-900 border-l-2"
                    : "text-gray-700 hover:text-gray-900 hover:bg-gray-50 border-l-2 border-transparent"
                }`}
                style={
                  active
                    ? { borderLeftColor: "var(--district-primary)" }
                    : undefined
                }
              >
                <Icon
                  className="w-5 h-5"
                  style={
                    active
                      ? { color: "var(--district-primary)" }
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
