/**
 * Apex/root redirect router. Signed-in users go to their role-based home;
 * everyone else goes to /login. Marketing landing page is a later ticket.
 */

import { redirect } from "next/navigation";
import { getCurrentUser, getRedirectPath } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { profile } = await getCurrentUser();
  if (profile) {
    redirect(getRedirectPath(profile.role));
  }
  redirect("/login");
}
