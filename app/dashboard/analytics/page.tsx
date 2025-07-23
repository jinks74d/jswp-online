import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import AnalyticsDashboard from "@/components/dashboard/analytics/AnalyticsDashboard";

export default async function AnalyticsPage() {
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

  // Only allow admins to access analytics
  if (!['super_admin', 'district_admin', 'school_admin'].includes(profile.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-7xl mx-auto">
      <AnalyticsDashboard
        userRole={profile.role}
        districtId={profile.district_id}
        schoolId={profile.school_id}
        districtName={profile.districts?.name}
        schoolName={profile.schools?.name}
      />
    </div>
  );
}