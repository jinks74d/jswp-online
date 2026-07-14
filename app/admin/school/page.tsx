import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// School admins moved to the /school sidebar shell — keep this path working for
// any old links/bookmarks by redirecting there.
export const metadata: Metadata = { title: "School Admin" };

export default async function SchoolAdminHome() {
  await requireRole("school_admin");
  redirect("/school");
}
