import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import NarrativeAssignmentForm from "@/components/dashboard/assignments/NarrativeAssignmentForm";

interface ClassPeriod {
  id: string;
  period: string;
  classes: {
    id: string;
    name: string;
    subjects: {
      id: string;
      name: string;
    };
  };
}

export default async function CreateNarrativeAssignmentPage() {
  const cookieStore = await cookies();
  const supabase = await createServerSupabaseClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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

  // Get teacher's assigned classes if they are a teacher
  let teacherClasses: ClassPeriod[] = [];
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

    teacherClasses = classAssignments?.map(assignment => assignment.class_period).filter(Boolean) || [];
  }

  return (
    <NarrativeAssignmentForm
      currentUserRole={profile.role}
      currentUserSchool={profile.schools}
      districtName={profile.districts?.name || "District"}
      districtId={profile.districts?.id || profile.district_id}
      teacherClasses={teacherClasses}
      userId={user.id}
    />
  );
}
