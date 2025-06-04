// app/dashboard/layout.tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = await createServerSupabaseClient(cookieStore);

  // Get current user and profile
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/");
  }

  // Get user profile with district and school info
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select(
      `
      *,
      districts:district_id(id, name, domain),
      schools:school_id(id, name)
    `
    )
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/");
  }

  // Redirect super admins to their dashboard
  if (profile.role === "super_admin") {
    redirect("/super-admin");
  }

  // Ensure user has a district (except super admins)
  if (!profile.district_id) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardSidebar profile={profile} />

      {/* Main content */}
      <div className="pl-64">
        <main className="py-8 px-8">{children}</main>
      </div>
    </div>
  );
}
