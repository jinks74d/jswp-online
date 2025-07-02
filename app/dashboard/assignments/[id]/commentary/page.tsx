import { createServerSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import CommentaryGenerationForm from "@/components/dashboard/assignments/CommentaryGenerationForm";
import ExpositoryWorkingTopicSentenceForm from "@/components/dashboard/assignments/ExpositoryWorkingTopicSentenceForm";
import ExpositoryCommentaryDevelopmentForm from "@/components/dashboard/assignments/ExpositoryCommentaryDevelopmentForm";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    step?: string;
  }>;
}

export default async function CommentaryPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { step } = await searchParams;
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

  // Render the appropriate form based on writing style and URL step parameter
  if (assignment.writing_style === "expository") {
    // If URL has step=3, show Commentary Development form
    if (step === "3") {
      return (
        <ExpositoryCommentaryDevelopmentForm 
          assignment={assignment} 
          studentProfile={userProfile} 
        />
      );
    }
    
    // Otherwise, check database for current step (fallback for direct navigation)
    const { data: progressData } = await supabase
      .from("student_progress")
      .select("concrete_details")
      .eq("assignment_id", id)
      .eq("student_id", userProfile.id)
      .single();

    let currentStep = "step_2"; // Default to Working Topic Sentence
    
    if (progressData?.concrete_details) {
      try {
        const parsedData = JSON.parse(progressData.concrete_details);
        currentStep = parsedData.working_on || "step_2";
      } catch (error) {
        console.log("Error parsing progress data:", error);
      }
    }

    // Render appropriate form based on current step from database
    if (currentStep === "step_3" || currentStep === "commentary_development") {
      return (
        <ExpositoryCommentaryDevelopmentForm 
          assignment={assignment} 
          studentProfile={userProfile} 
        />
      );
    } else {
      // Default to Working Topic Sentence form (step 2)
      return (
        <ExpositoryWorkingTopicSentenceForm 
          assignment={assignment} 
          studentProfile={userProfile} 
        />
      );
    }
  }

  // Default to literary commentary form for other writing styles
  return (
    <CommentaryGenerationForm 
      assignment={assignment} 
      studentProfile={userProfile} 
    />
  );
}
