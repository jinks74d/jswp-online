// app/dashboard/assignments/[id]/start/page.tsx
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import StudentAssignmentForm from "@/components/dashboard/assignments/StudentAssignmentForm";
import ExpositoryStudentForm from "@/components/dashboard/assignments/ExpositoryStudentForm";

interface StartAssignmentPageProps {
  params: Promise<{ id: string }>;
}

export default async function StartAssignmentPage({ params }: StartAssignmentPageProps) {
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

  // Only students can start assignments
  if (profile.role !== "student") {
    redirect("/dashboard/assignments");
  }

  // Fetch the assignment details with course information
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
    console.error("Assignment ID:", id);
    console.error("User profile:", profile);
    redirect("/dashboard/assignments");
  }

  // For now, allow students from the same school to access assignments
  // TODO: Implement proper class enrollment checking
  if (assignment.school_id && assignment.school_id !== profile.school_id) {
    console.error("School mismatch:", assignment.school_id, "vs", profile.school_id);
    redirect("/dashboard/assignments");
  }

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

  // Render the appropriate form based on writing style
  if (assignment.writing_style === "expository") {
    return (
      <ExpositoryStudentForm
        assignment={assignmentWithClassInfo}
        studentProfile={profile}
      />
    );
  }

  if (assignment.writing_style === "argumentation") {
    // For argumentation, redirect to the gathering CDs step
    redirect(`/dashboard/assignments/${id}/gathering-cds`);
  }

  // Default to literary form for other writing styles
  return (
    <StudentAssignmentForm
      assignment={assignmentWithClassInfo}
      studentProfile={profile}
    />
  );
}
