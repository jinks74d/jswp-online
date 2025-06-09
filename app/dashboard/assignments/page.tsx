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

  // All authenticated users can access assignments (students, teachers, admins)
  let assignments = [];
  let error = null;

  if (profile.role === "student") {
    // TEMPORARY: Until class_period_id is added to assignments table,
    // show assignments from the same school for students
    console.log('Fetching assignments for student in school:', profile.school_id);
    
    const { data: studentAssignments, error: studentError } = await supabase
      .from('assignments')
      .select(`
        *,
        user_profiles!assignments_teacher_id_fkey(
          first_name,
          last_name
        )
      `)
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: false });

    console.log('Assignments found for student:', studentAssignments?.length || 0);
    assignments = studentAssignments || [];
    error = studentError;
  } else if (["teacher", "school_admin", "district_admin"].includes(profile.role)) {
    // For teachers and admins: fetch assignments they created or can manage
    console.log('Fetching assignments for teacher:', profile.id);
    
    // First try a simple query without joins to see if assignments exist
    const { data: teacherAssignments, error: teacherError } = await supabase
      .from('assignments')
      .select('*')
      .eq('teacher_id', profile.id)
      .order('created_at', { ascending: false });

    console.log('Assignments found for teacher:', teacherAssignments?.length || 0);
    console.log('Assignment data:', teacherAssignments);
    console.log('Query error:', teacherError);
    
    assignments = teacherAssignments || [];
    error = teacherError;
  }

  if (error) {
    console.error('Error fetching assignments:', error);
  }

  // Transform assignments to match the expected interface
  const transformedAssignments = (assignments || []).map(assignment => ({
    id: assignment.id,
    title: assignment.title,
    description: assignment.description,
    subject: assignment.class_periods?.classes?.subjects?.name || "Subject",
    class_name: assignment.class_periods?.classes?.name || "Class",
    period: assignment.class_periods?.period || "",
    teacher_name: assignment.user_profiles ? 
      `${assignment.user_profiles.first_name} ${assignment.user_profiles.last_name}` : 
      "Teacher",
    due_date: assignment.due_date,
    created_at: assignment.created_at,
    status: "active",
    submissions_count: 0,
    total_students: 0,
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
