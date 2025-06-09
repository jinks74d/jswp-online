// app/dashboard/assignments/[id]/page.tsx
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import AssignmentDetail from "@/components/dashboard/assignments/AssignmentDetail";

interface AssignmentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AssignmentDetailPage({ params }: AssignmentDetailPageProps) {
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

  if (!profile) {
    redirect("/");
  }

  // Fetch the assignment details
  const { data: assignment, error } = await supabase
    .from("assignments")
    .select(`
      *,
      user_profiles!assignments_teacher_id_fkey(
        first_name,
        last_name,
        email
      )
    `)
    .eq("id", id)
    .single();

  if (error || !assignment) {
    console.error("Error fetching assignment:", error);
    redirect("/dashboard/assignments");
  }

  // Check if user has permission to view this assignment
  if (profile.role === "student") {
    // Students can only view assignments from their school (temporary until class enrollment is implemented)
    if (assignment.school_id !== profile.school_id) {
      redirect("/dashboard/assignments");
    }
  } else if (profile.role === "teacher") {
    // Teachers can only view their own assignments
    if (assignment.teacher_id !== user.id) {
      redirect("/dashboard/assignments");
    }
  }
  // School and district admins can view all assignments in their scope

  return (
    <AssignmentDetail
      assignment={assignment}
      currentUserRole={profile.role}
      currentUserId={user.id}
      currentUserSchool={profile.schools}
      districtName={profile.districts?.name || "District"}
    />
  );
}
