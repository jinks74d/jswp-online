// app/dashboard/assignments/[id]/gathering-cds/page.tsx
import { createServerSupabaseClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import GatheringCdsForm from "@/components/dashboard/assignments/GatheringCdsForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GatheringCdsPage({ params }: PageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = await createServerSupabaseClient(cookieStore);

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/login");
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
    redirect("/auth/login");
  }

  // Only students should access this page
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <GatheringCdsForm assignment={assignment} studentProfile={profile} />
      </div>
    </div>
  );
}
