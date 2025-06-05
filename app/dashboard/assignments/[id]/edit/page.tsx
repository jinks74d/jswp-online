// app/dashboard/assignments/[id]/edit/page.tsx
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import EditAssignmentForm from "@/components/dashboard/assignments/EditAssignmentForm";

interface EditAssignmentPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditAssignmentPage({
  params,
}: EditAssignmentPageProps) {
  const resolvedParams = await params;
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

  // Only teachers, school admins, and district admins can access assignments
  if (!["teacher", "school_admin", "district_admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  // Fetch the specific assignment
  const { data: assignment, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", resolvedParams.id)
    .single();

  if (error || !assignment) {
    redirect("/dashboard/assignments");
  }

  // Check if user has permission to edit this assignment (only the teacher who created it)
  if (assignment.teacher_id !== user.id) {
    redirect("/dashboard/assignments");
  }

  // Get teacher's assigned classes if they are a teacher
  let teacherClasses = [];
  if (profile.role === "teacher") {
    const { data: classAssignments } = await supabase
      .from("class_teacher_assignments")
      .select(`
        *,
        class_period:class_period_id(
          id,
          period,
          classes:class_id(
            id,
            name,
            subjects:subject_id(
              id,
              name
            )
          )
        )
      `)
      .eq("teacher_id", user.id);

    teacherClasses = classAssignments?.map(assignment => assignment.class_period) || [];
  }

  return (
    <EditAssignmentForm
      assignment={assignment}
      currentUserRole={profile.role}
      currentUserSchool={profile.schools}
      districtName={profile.districts?.name || "District"}
      districtId={profile.districts?.id || profile.district_id}
      teacherClasses={teacherClasses}
      userId={user.id}
    />
  );
}
