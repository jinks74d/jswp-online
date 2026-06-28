import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// School admins moved to the /school sidebar shell — keep this path working for
// any old links/bookmarks by redirecting there.
export default async function SchoolAdminHome() {
  await requireRole("school_admin");
  redirect("/school");
}
