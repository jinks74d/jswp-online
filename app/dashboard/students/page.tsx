// app/dashboard/students/page.tsx
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import StudentsList from "@/components/dashboard/students/StudentsList";

export default async function StudentsPage() {
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

  // Debug logging
  console.log("Students page - User:", user?.email);
  console.log("Students page - Profile:", JSON.stringify(profile, null, 2));

  if (!profile || !profile.district_id) {
    console.log("Students page - Redirecting to / because:", !profile ? "no profile" : "no district_id");
    redirect("/");
  }

  // Only district admins, school admins, and teachers can access this page
  if (!["district_admin", "school_admin", "teacher"].includes(profile.role)) {
    console.log("Students page - Redirecting to /dashboard because role is:", profile.role);
    redirect("/dashboard");
  }

  // Build query based on user role
  let studentsQuery = supabase
    .from("user_profiles")
    .select(
      `
      *,
      schools:school_id(id, name)
    `
    )
    .eq("role", "student")
    .eq("district_id", profile.district_id);

  // School admins and teachers can only see students from their school
  if (
    (profile.role === "school_admin" || profile.role === "teacher") &&
    profile.school_id
  ) {
    studentsQuery = studentsQuery.eq("school_id", profile.school_id);
  }

  const { data: students, error: studentsError } = await studentsQuery.order(
    "created_at",
    { ascending: false }
  );

  if (studentsError) {
    console.error("Error fetching students:", studentsError);
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
    <StudentsList
      students={students || []}
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
