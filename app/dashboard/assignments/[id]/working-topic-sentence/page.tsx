// app/dashboard/assignments/[id]/working-topic-sentence/page.tsx
import { createServerSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import ArgumentationWorkingTSForm from "@/components/dashboard/assignments/ArgumentationWorkingTSForm";
import ExpositoryWorkingTopicSentenceForm from "@/components/dashboard/assignments/ExpositoryWorkingTopicSentenceForm";
import UnifiedWorkingTopicSentenceForm from "@/components/dashboard/assignments/unified/UnifiedWorkingTopicSentenceForm";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function WorkingTopicSentencePage({ params }: PageProps) {
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

  // Check feature flag for unified form
  const useUnifiedForm = process.env.USE_UNIFIED_WORKING_TS_FORM === 'true';

  if (useUnifiedForm) {
    // Use unified form for both argumentation and expository
    if (assignment.writing_style === "argumentation" || assignment.writing_style === "expository") {
      return (
        <UnifiedWorkingTopicSentenceForm
          assignment={assignment}
          studentProfile={userProfile}
        />
      );
    }
  }

  // Legacy fallback - render style-specific forms
  if (assignment.writing_style === "argumentation") {
    return (
      <ArgumentationWorkingTSForm
        assignment={assignment}
        studentProfile={userProfile}
      />
    );
  }

  if (assignment.writing_style === "expository") {
    return (
      <ExpositoryWorkingTopicSentenceForm
        assignment={assignment}
        studentProfile={userProfile}
      />
    );
  }

  // This step doesn't exist for narrative/literary
  redirect("/dashboard/assignments");
}
