// app/dashboard/assignments/[id]/working-topic-sentence/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase";
import ArgumentationWorkingTSForm from "@/components/dashboard/assignments/ArgumentationWorkingTSForm";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function WorkingTopicSentencePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = createClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/");
  }

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select(`
      *,
      districts (id, name),
      schools (id, name)
    `)
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/");
  }

  // Only students can access this page
  if (profile.role !== "student") {
    redirect("/dashboard");
  }

  // Get assignment details
  const { data: assignment, error: assignmentError } = await supabase
    .from("assignments")
    .select(`
      *,
      user_profiles!assignments_teacher_id_fkey (
        first_name,
        last_name,
        email
      ),
      class_periods (
        id,
        period,
        classes (
          id,
          name,
          subjects (
            id,
            name
          )
        )
      )
    `)
    .eq("id", id)
    .single();

  if (assignmentError || !assignment) {
    redirect("/dashboard/assignments");
  }

  // Verify this is an argumentation assignment
  if (assignment.writing_style !== "argumentation") {
    redirect(`/dashboard/assignments/${id}`);
  }

  return (
    <ArgumentationWorkingTSForm
      assignment={assignment}
      studentProfile={profile}
    />
  );
}
