import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { adminDashboardPath } from "@/lib/admin-kinds";

export const dynamic = "force-dynamic";

// Bare /admin/school — send the admin to their own kind's dashboard.
export default async function SchoolAdminHome() {
  const profile = await requireRole("school_admin");
  redirect(adminDashboardPath(profile.admin_kind));
}
