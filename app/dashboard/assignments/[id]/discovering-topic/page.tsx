import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import NarrativeDiscoveringTopicForm from "@/components/dashboard/assignments/NarrativeDiscoveringTopicForm";

export default async function NarrativeDiscoveringTopicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const cookieStore = await cookies();
  const supabase = await createServerSupabaseClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log("No user found, redirecting to login");
    redirect("/login");
  }

  console.log("User found:", user.id);

  const { data: profile } = await supabase
    .from("user_profiles")
    .select(`
      *,
      districts:district_id(id, name),
      schools:school_id(id, name)
    `)
    .eq("id", user.id)
    .single();

  if (!profile) {
    console.log("No profile found, redirecting to login");
    redirect("/login");
  }

  console.log("Profile found:", {
    id: profile.id,
    role: profile.role,
    school_id: profile.school_id,
    first_name: profile.first_name,
    last_name: profile.last_name
  });

  // Only students can access this form
  if (profile.role !== "student") {
    console.log("User is not a student, redirecting to dashboard");
    redirect("/dashboard/assignments");
  }

  console.log("Fetching assignment:", resolvedParams.id);

  // Get assignment details
  const { data: assignment, error: assignmentError } = await supabase
    .from("assignments")
    .select(`
      *,
      user_profiles!assignments_teacher_id_fkey(
        first_name,
        last_name,
        email
      )
    `)
    .eq("id", resolvedParams.id)
    .single();

  if (assignmentError || !assignment) {
    console.error("Error fetching assignment:", assignmentError);
    console.log("Assignment ID:", resolvedParams.id);
    redirect("/dashboard/assignments");
  }

  console.log("Assignment found:", {
    id: assignment.id,
    title: assignment.title,
    writing_style: assignment.writing_style,
    school_id: assignment.school_id,
    teacher_id: assignment.teacher_id
  });

  // For now, allow students from the same school to access assignments
  // TODO: Implement proper class enrollment checking
  if (assignment.school_id && assignment.school_id !== profile.school_id) {
    console.error("School mismatch in discovering-topic:", assignment.school_id, "vs", profile.school_id);
    redirect("/dashboard/assignments");
  }

  console.log("All checks passed, rendering NarrativeDiscoveringTopicForm");

  // Fetch class period information separately if it exists
  let classPeriodInfo = null;
  if (assignment.class_period_id) {
    const { data: classPeriod } = await supabase
      .from("class_periods")
      .select(`
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
      `)
      .eq("id", assignment.class_period_id)
      .single();
    
    classPeriodInfo = classPeriod;
  }

  // Add class period info to assignment object
  const assignmentWithClassInfo = {
    ...assignment,
    class_periods: classPeriodInfo
  };

  return (
    <NarrativeDiscoveringTopicForm
      assignment={assignmentWithClassInfo}
      studentProfile={profile}
    />
  );
}
