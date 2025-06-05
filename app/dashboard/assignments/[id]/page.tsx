// app/dashboard/assignments/[id]/page.tsx
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import AssignmentDetail from "@/components/dashboard/assignments/AssignmentDetail";

interface AssignmentDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AssignmentDetailPage({
  params,
}: AssignmentDetailPageProps) {
  const resolvedParams = await params;
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

  // Only teachers, school admins, and district admins can access assignments
  if (!["teacher", "school_admin", "district_admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  // Fetch the specific assignment
  const { data: assignment, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", resolvedParams.id)
    .single();

  if (error || !assignment) {
    redirect("/dashboard/assignments");
  }

  // Check if user has permission to view this assignment
  const canView = 
    assignment.teacher_id === user.id || // Teacher owns the assignment
    (profile.role === "school_admin" && assignment.school_id === profile.school_id) || // School admin in same school
    (profile.role === "district_admin" && assignment.district_id === profile.district_id); // District admin in same district

  if (!canView) {
    redirect("/dashboard/assignments");
  }

  return (
    <AssignmentDetail
      assignment={assignment}
      currentUserRole={profile.role}
      currentUserId={user.id}
      currentUserSchool={profile.schools}
      districtName={profile.districts?.name || "District"}
    />
  );
}
