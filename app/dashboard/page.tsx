// app/dashboard/page.tsx
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import DistrictAdminDashboard from "@/components/dashboard/DistrictAdminDashboard";
import SchoolAdminDashboard from "@/components/dashboard/SchoolAdminDashboard";
import TeacherDashboard from "@/components/dashboard/TeacherDashboard";
import StudentDashboard from "@/components/dashboard/StudentDashboard";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = await createServerSupabaseClient(cookieStore);

  // Get current user profile
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Access denied</div>;
  }

  const { data: profile } = await supabase
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

  if (!profile) {
    return <div>Profile not found</div>;
  }

  // Render role-specific dashboard
  switch (profile.role) {
    case "district_admin":
      return <DistrictAdminDashboard profile={profile} />;

    case "school_admin":
      return <SchoolAdminDashboard profile={profile} />;

    case "teacher":
      return <TeacherDashboard profile={profile} />;

    case "student":
      return <StudentDashboard profile={profile} />;

    default:
      return (
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Welcome to EduPlatform
          </h1>
          <p className="text-gray-600">Your dashboard is being prepared...</p>
        </div>
      );
  }
}
