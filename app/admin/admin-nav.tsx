"use client";

/**
 * Admin section nav. Highlights the active route with a crimson underline
 * (the admin chrome accent). Super-admin-only links are gated by role.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string };

export function AdminNav({ role }: { role: string }) {
  const pathname = usePathname();

  const links: NavLink[] = [
    { href: "/admin/signups", label: "Signup requests" },
    { href: "/admin/import/students", label: "Import students" },
    ...(role === "super_admin"
      ? [
          { href: "/admin/districts", label: "Districts" },
          { href: "/admin/users", label: "Users" },
          { href: "/admin/super-admins", label: "Super admins" },
        ]
      : []),
  ];

  return (
    <nav className="flex items-stretch gap-6 text-sm">
      {links.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex h-16 items-center border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 ${
              active
                ? "border-rose-600 font-medium text-gray-900"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
