// app/dashboard/students/[id]/page.tsx
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import { redirect, notFound } from "next/navigation";
import StudentDetail from "@/components/dashboard/students/StudentDetail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentDetailPage({ params }: PageProps) {
  const { id } = await params;
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
      districts:district_id(id, name),
      schools:school_id(id, name)
    `
    )
    .eq("id", user.id)
    .single();

  if (!profile || !profile.district_id) {
    redirect("/");
  }

  // Only district admins, school admins, and teachers can access student details
  if (!["district_admin", "school_admin", "teacher"].includes(profile.role)) {
    redirect("/dashboard");
  }

  // Fetch the student
  let studentQuery = supabase
    .from("user_profiles")
    .select(
      `
      *,
      schools:school_id(id, name),
      districts:district_id(id, name)
    `
    )
    .eq("id", id)
    .eq("role", "student")
    .single();

  const { data: student, error: studentError } = await studentQuery;

  if (studentError || !student) {
    notFound();
  }

  // Verify access permissions
  if (profile.role === "school_admin" || profile.role === "teacher") {
    // School admins and teachers can only access students from their school
    if (student.school_id !== profile.school_id) {
      redirect("/dashboard/students");
    }
  } else if (profile.role === "district_admin") {
    // District admins can only access students from their district
    if (student.district_id !== profile.district_id) {
      redirect("/dashboard/students");
    }
  }

  return (
    <StudentDetail
      student={student}
      currentUserRole={profile.role}
      currentUserSchoolId={profile.school_id}
      districtId={profile.district_id}
      districtName={profile.districts?.name || "District"}
    />
  );
}
