import { createServerSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import GatheringCdsForm from "@/components/dashboard/assignments/GatheringCdsForm";
import ExpositoryGatheringCdsForm from "@/components/dashboard/assignments/ExpositoryGatheringCdsForm";
import ArgumentationGatheringCdsForm from "@/components/dashboard/assignments/ArgumentationGatheringCdsForm";
import NarrativeGatheringCdsForm from "@/components/dashboard/assignments/NarrativeGatheringCdsForm";
import UnifiedGatheringCDsForm from "@/components/dashboard/assignments/unified/UnifiedGatheringCDsForm";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function GatheringCdsPage({ params }: PageProps) {
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

  // Feature flag: Use unified form or legacy style-specific forms
  const useUnifiedForm = process.env.USE_UNIFIED_GATHERING_CDS_FORM === 'true';

  if (useUnifiedForm) {
    // NEW: Single unified component for all writing styles
    return (
      <UnifiedGatheringCDsForm
        assignment={assignment}
        studentProfile={userProfile}
      />
    );
  }

  // LEGACY: Style-specific components (fallback for safety)
  // Render the appropriate form based on writing style
  if (assignment.writing_style === "expository") {
    return (
      <ExpositoryGatheringCdsForm
        assignment={assignment}
        studentProfile={userProfile}
      />
    );
  }

  if (assignment.writing_style === "argumentation") {
    return (
      <ArgumentationGatheringCdsForm
        assignment={assignment}
        studentProfile={userProfile}
      />
    );
  }

  if (assignment.writing_style === "narrative") {
    return (
      <NarrativeGatheringCdsForm
        assignment={assignment}
        studentProfile={userProfile}
      />
    );
  }

  // Default to literary form for other writing styles
  return (
    <GatheringCdsForm
      assignment={assignment}
      studentProfile={userProfile}
    />
  );
}
