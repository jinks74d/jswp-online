// app/dashboard/assignments/page.tsx
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import AssignmentsList from "@/components/dashboard/assignments/AssignmentsList";

export default async function AssignmentsPage() {
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

  // Fetch assignments from database
  const { data: assignments, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching assignments:', error);
  }

  // Transform assignments to match the expected interface
  const transformedAssignments = (assignments || []).map(assignment => ({
    id: assignment.id,
    title: assignment.title,
    description: assignment.description,
    subject: "Literary", // Default for now
    class_name: "Class", // Default for now
    due_date: assignment.due_date,
    created_at: assignment.created_at,
    status: "active", // Default for now
    submissions_count: 0, // Default for now
    total_students: 0, // Default for now
  }));

  return (
    <AssignmentsList
      assignments={transformedAssignments}
      currentUserRole={profile.role}
      currentUserSchool={profile.schools}
      districtName={profile.districts?.name || "District"}
    />
  );
}
