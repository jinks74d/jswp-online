// app/dashboard/assignments/create/expository/page.tsx
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import ExpositoryAssignmentForm from "@/components/dashboard/assignments/ExpositoryAssignmentForm";

export default async function CreateExpositoryAssignmentPage() {
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

  // Only teachers, school admins, and district admins can create assignments
  if (!["teacher", "school_admin", "district_admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  // Get teacher's classes if they are a teacher
  let teacherClasses: any[] = [];
  if (profile.role === "teacher") {
    const { data: classes } = await supabase
      .from("class_teacher_assignments")
      .select(`
        class_periods:class_period_id(
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

    teacherClasses = classes?.map(c => c.class_periods).filter(Boolean) || [];
  }

  return (
    <ExpositoryAssignmentForm
      currentUserRole={profile.role}
      currentUserSchool={profile.schools}
      districtName={profile.districts?.name || ""}
      districtId={profile.district_id}
      teacherClasses={teacherClasses}
      userId={user.id}
      userName={profile.first_name || "Teacher"}
    />
  );
}
