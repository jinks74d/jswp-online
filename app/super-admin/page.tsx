/**
 * Bookmarked-URL handler. The legacy super-admin home is replaced by
 * /admin (which serves super, district, and school admins). This file
 * forwards stale links there.
 */

import { redirect } from "next/navigation";
import { getCurrentUser, getRedirectPath } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SuperAdminRedirect() {
  const { profile } = await getCurrentUser();
  if (!profile) redirect("/login");
  redirect(getRedirectPath(profile.role));
}
