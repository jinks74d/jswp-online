// app/dashboard/layout.tsx
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/server";
import { SessionTrackingProvider } from "@/components/analytics/SessionTrackingProvider";
import { DashboardWrapper } from "./dashboard-wrapper";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Require authentication at the layout level
  const session = await requireAuth();
  
  // Ensure only appropriate roles can access dashboard
  const allowedRoles = ["district_admin", "school_admin", "teacher", "student"];
  if (!allowedRoles.includes(session.profile.role)) {
    // Super admin should use /super-admin route
    if (session.profile.role === "super_admin") {
      redirect("/super-admin");
    } else {
      redirect("/unauthorized");
    }
  }

  return (
    <DashboardWrapper 
      session={session}
    >
      {children}
    </DashboardWrapper>
  );
}