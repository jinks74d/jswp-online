// app/dashboard/page.tsx
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import DistrictAdminDashboard from "@/components/dashboard/DistrictAdminDashboard";
import SchoolAdminDashboard from "@/components/dashboard/SchoolAdminDashboard";
import TeacherDashboard from "@/components/dashboard/TeacherDashboard";
import StudentDashboard from "@/components/dashboard/StudentDashboard";
import { FallbackDashboard } from "@/components/dashboard/FallbackDashboard";
import { Suspense } from "react";

// PERFORMANCE: Use dynamic rendering with caching for static parts
export const dynamic = "force-dynamic";
export const revalidate = 0; // No caching for dashboard to ensure fresh data

export default async function DashboardPage() {
  let user = null;
  let profile = null;

  // PERFORMANCE: Optimized server-side auth with faster timeouts and better error handling
  try {
    const cookieStore = await cookies();
    const supabase = await createServerSupabaseClient(cookieStore);

    // PERFORMANCE: Reduced timeout for faster failure detection
    const authPromise = supabase.auth.getUser();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Auth timeout")), 1500) // Reduced from 2000ms
    );

    const userResult = await Promise.race([authPromise, timeoutPromise]);
    const { data: userData, error: userError } = userResult as any;

    if (userError || !userData?.user) {
      // Fail fast and use fallback component
      return <FallbackDashboard />;
    }

    user = userData.user;

    // PERFORMANCE: Optimized profile query with only necessary fields
    const profilePromise = supabase
      .from("user_profiles")
      .select("id, role, district_id, school_id, first_name, last_name, email, districts:district_id(id, name, domain, logo_url, primary_color, secondary_color), schools:school_id(id, name)")
      .eq("id", user.id)
      .maybeSingle(); // Use maybeSingle to avoid errors

    const profileTimeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Profile timeout")), 1500) // Reduced from 2000ms
    );

    const profileResult = await Promise.race([profilePromise, profileTimeoutPromise]);
    const { data: profileData, error: profileError } = profileResult as any;

    if (profileError || !profileData) {
      // Fail fast and use fallback component
      return <FallbackDashboard />;
    }

    profile = profileData;
  } catch (error) {
    console.warn("Dashboard Page: Server auth failed, using fallback component");
    // Always fallback to fallback component on any error
    return <FallbackDashboard />;
  }

  // If server-side auth failed, use fallback component
  if (!user || !profile) {
    return <FallbackDashboard />;
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
