// app/dashboard/teachers/page.tsx
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import TeachersList from "@/components/dashboard/teachers/TeachersList";

export default async function TeachersPage() {
  const cookieStore = await cookies();
  const supabase = await createServerSupabaseClient(cookieStore);

  // Get current user and verify permissions
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select(
      `
      *,
      districts:district_id(id, name, logo_url, primary_color, secondary_color),
      schools:school_id(id, name, logo_url, primary_color, secondary_color)
    `
    )
    .eq("id", user.id)
    .single();

  if (!profile || !profile.district_id) {
    redirect("/");
  }

  // Only district admins, school admins, and teachers can access this page
  if (!["district_admin", "school_admin", "teacher"].includes(profile.role)) {
    redirect("/dashboard");
  }

  // Build query based on user role
  let teachersQuery = supabase
    .from("user_profiles")
    .select(
      `
      *,
      schools:school_id(id, name)
    `
    )
    .eq("role", "teacher")
    .eq("district_id", profile.district_id);

  // School admins can only see teachers from their school
  if (profile.role === "school_admin" && profile.school_id) {
    teachersQuery = teachersQuery.eq("school_id", profile.school_id);
  }

  const { data: teachers, error: teachersError } = await teachersQuery.order(
    "created_at",
    { ascending: false }
  );

  if (teachersError) {
    console.error("Error fetching teachers:", teachersError);
  }

  // Fetch schools for filtering (district admins only)
  let schools: any[] = [];
  if (profile.role === "district_admin") {
    const { data: schoolsData } = await supabase
      .from("schools")
      .select("id, name")
      .eq("district_id", profile.district_id)
      .order("name");

    schools = schoolsData || [];
  }

  return (
    <TeachersList
      teachers={teachers || []}
      schools={schools}
      currentUserRole={profile.role}
      currentUserSchool={profile.schools}
      districtName={profile.districts?.name || "District"}
      districtBranding={{
        primary_color: profile.districts?.primary_color || null,
        secondary_color: profile.districts?.secondary_color || null,
        logo_url: profile.districts?.logo_url || null,
      }}
      schoolBranding={profile.role === "school_admin" && profile.schools ? {
        primary_color: profile.schools.primary_color || null,
        secondary_color: profile.schools.secondary_color || null,
        logo_url: profile.schools.logo_url || null,
      } : undefined}
    />
  );
}
