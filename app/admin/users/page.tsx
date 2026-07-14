import type { Metadata } from "next";
/**
 * /admin/users — cross-district user listing for super admins. Read-only:
 * super admins provision users via /admin/districts (POCs) and /admin/signups,
 * not here. Name/email search with role + district filters over every user in
 * every district. RLS (user_profiles_super_admin_all) permits the cross-tenant
 * read; the admin layout gates to admin roles and this page re-gates to
 * super_admin specifically.
 */

import { requireRole } from "@/lib/auth";
import { listAllUsers } from "@/lib/queries/all-users";
import { AllUsersView } from "./all-users-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage() {
  await requireRole("super_admin");

  const users = await listAllUsers();

  const districts = Array.from(
    new Set(users.map((u) => u.districtName).filter((n): n is string => !!n))
  ).sort((a, b) => a.localeCompare(b));

  return <AllUsersView users={users} districts={districts} />;
}
