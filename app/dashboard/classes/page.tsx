// app/dashboard/classes/page.tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import ClassesList from "@/components/dashboard/classes/ClassesList";

export default async function ClassesPage() {
  const cookieStore = await cookies();
  const supabase = await createServerSupabaseClient(cookieStore);

  // Get current user and profile
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/");
  }

  // Get user profile with school info
  const { data: profile, error: profileError } = await supabase
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

  if (profileError || !profile) {
    redirect("/");
  }

  // Get class periods based on user role
  let classPeriods;
  let classPeriodsError;

  if (profile.role === "teacher") {
    // For teachers, only show classes they're assigned to
    const { data, error } = await supabase
      .from("class_teacher_assignments")
      .select(`
        *,
        class_period:class_period_id(
          *,
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
      .eq("teacher_id", user.id)
      .order("created_at");

    classPeriods = data?.map(assignment => assignment.class_period) || [];
    classPeriodsError = error;
  } else {
    // For admins, show all classes in the school
    const { data, error } = await supabase
      .from("class_periods")
      .select(`
        *,
        classes:class_id(
          id,
          name,
          subjects:subject_id(
            id,
            name
          )
        )
      `)
      .eq("school_id", profile.school_id)
      .order("period");

    classPeriods = data;
    classPeriodsError = error;
  }

  // Get student enrollment counts for each class period
  if (classPeriods && classPeriods.length > 0) {
    const classPeriodsWithCounts = await Promise.all(
      classPeriods.map(async (classPeriod) => {
        const { count } = await supabase
          .from("class_student_enrollments")
          .select("*", { count: "exact", head: true })
          .eq("class_period_id", classPeriod.id);

        return {
          ...classPeriod,
          studentCount: count || 0,
        };
      })
    );

    classPeriods = classPeriodsWithCounts;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Classes</h1>
        <p className="text-gray-600 mt-1">
          Manage class periods and schedules for {profile.schools?.name}
        </p>
      </div>

      {/* Classes List */}
      <ClassesList
        classPeriods={classPeriods || []}
        profile={profile}
      />
    </div>
  );
}
