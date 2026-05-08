/**
 * Bookmarked-URL handler. /dashboard was the legacy post-login landing for
 * non-super-admin roles. Now it just routes to the correct v2 destination
 * via getRedirectPath, or to /login if the visitor isn't signed in.
 */

import { redirect } from "next/navigation";
import { getCurrentUser, getRedirectPath } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardRedirect() {
  const { profile } = await getCurrentUser();
  if (!profile) redirect("/login");
  redirect(getRedirectPath(profile.role));
}
