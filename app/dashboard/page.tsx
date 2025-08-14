// app/dashboard/page.tsx
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import DistrictAdminDashboard from "@/components/dashboard/DistrictAdminDashboard";
import SchoolAdminDashboard from "@/components/dashboard/SchoolAdminDashboard";
import TeacherDashboard from "@/components/dashboard/TeacherDashboard";
import StudentDashboard from "@/components/dashboard/StudentDashboard";
import { ClientDashboardPage } from "@/components/dashboard/ClientDashboardPage";

export default async function DashboardPage() {
  let user = null;
  let profile = null;

  try {
    const cookieStore = await cookies();
    const supabase = await createServerSupabaseClient(cookieStore);

    // Get current user profile with timeout
    const userResult = await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('User fetch timeout')), 2000)
      )
    ]);

    const { data: userData, error: userError } = userResult as any;
    
    if (userError || !userData?.user) {
      console.log('Dashboard Page: No user found, using client-side component');
      user = null;
    } else {
      user = userData.user;
    }

    if (user) {
      const profileResult = await Promise.race([
        supabase
          .from("user_profiles")
          .select(
            `
            *,
            districts:district_id(id, name, domain, logo_url, primary_color, secondary_color),
            schools:school_id(id, name)
          `
          )
          .eq("id", user.id)
          .single(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile fetch timeout')), 2000)
        )
      ]);

      const { data: profileData, error: profileError } = profileResult as any;
      
      if (profileError || !profileData) {
        console.log('Dashboard Page: No profile found, using client-side component');
        profile = null;
      } else {
        profile = profileData;
      }
    }
  } catch (error) {
    console.error('Dashboard Page: Error during auth check:', error);
    user = null;
    profile = null;
  }

  // If server-side auth failed, use client-side component
  if (!user || !profile) {
    return <ClientDashboardPage />;
  }

  // Server-side auth succeeded, render role-specific dashboard
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
            Welcome to JSWP Online
          </h1>
          <p className="text-gray-600">Your dashboard is being prepared...</p>
        </div>
      );
  }
}
