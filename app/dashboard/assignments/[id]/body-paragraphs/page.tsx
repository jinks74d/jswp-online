import { createServerSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import BodyParagraphsForm from "@/components/dashboard/assignments/BodyParagraphsForm";
import NarrativeBodyParagraphsForm from "@/components/dashboard/assignments/NarrativeBodyParagraphsForm";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function BodyParagraphsPage({ params }: PageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = await createServerSupabaseClient(cookieStore);

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/");
  }

  // Get user profile
  const { data: userProfile, error: profileError } = await supabase
    .from("user_profiles")
    .select(`
      *,
      districts:district_id(id, name),
      schools:school_id(id, name)
    `)
    .eq("id", user.id)
    .single();

  if (profileError || !userProfile) {
    redirect("/");
  }

  // Only allow students to access this page
  if (userProfile.role !== "student") {
    redirect("/dashboard");
  }

  // Get assignment details
  const { data: assignment, error: assignmentError } = await supabase
    .from("assignments")
    .select(`
      *,
      user_profiles:teacher_id(first_name, last_name, email),
      class_periods:class_period_id(
        id,
        period,
        classes:class_id(
          id,
          name,
          subjects:subject_id(id, name)
        )
      )
    `)
    .eq("id", id)
    .single();

  if (assignmentError || !assignment) {
    redirect("/dashboard/assignments");
  }

  // Render appropriate form based on writing style
  if (assignment.writing_style === "narrative") {
    return (
      <NarrativeBodyParagraphsForm 
        assignment={assignment} 
        studentProfile={userProfile} 
      />
    );
  }

  return (
    <BodyParagraphsForm 
      assignment={assignment} 
      studentProfile={userProfile} 
    />
  );
}
