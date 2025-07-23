import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import AnalyticsDashboard from "@/components/dashboard/analytics/AnalyticsDashboard";

export default async function SuperAdminAnalyticsPage() {
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

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/");
  }

  // Only allow super admins
  if (profile.role !== 'super_admin') {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-7xl mx-auto">
      <AnalyticsDashboard
        userRole={profile.role}
        districtName="All Districts"
      />
    </div>
  );
}