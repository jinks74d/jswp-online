// app/dashboard/assignments/page.tsx
"use client";

import { useAuth } from "@/components/auth/OptimizedAuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import AssignmentsList from "@/components/dashboard/assignments/AssignmentsList";

export default function AssignmentsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const supabase = createClient();

  // Redirect if not authorized
  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.replace("/");
      return;
    }
  }, [user, profile, loading, router]);

  // Fetch assignments data
  useEffect(() => {
    if (!profile || !user) {
      return;
    }

    const fetchAssignments = async () => {
      try {
        let assignmentsData = [];
        let error = null;

        if (profile.role === "student") {
          // TEMPORARY: Until class_period_id is added to assignments table,
          // show assignments from the same school for students
          console.log(
            "Fetching assignments for student in school:",
            profile.school_id
          );

          const { data: studentAssignments, error: studentError } =
            await supabase
              .from("assignments")
              .select(
                `
              *,
              user_profiles!assignments_teacher_id_fkey(
                first_name,
                last_name
              )
            `
              )
              .eq("school_id", profile.school_id)
              .order("created_at", { ascending: false });

          console.log(
            "Assignments found for student:",
            studentAssignments?.length || 0
          );
          assignmentsData = studentAssignments || [];
          error = studentError;
        } else if (profile.role === "teacher") {
          // For teachers: fetch assignments they created
          console.log("Fetching assignments for teacher:", profile.id);

          const { data: teacherAssignments, error: teacherError } =
            await supabase
              .from("assignments")
              .select(
                `
              *,
              user_profiles!assignments_teacher_id_fkey(
                first_name,
                last_name
              )
            `
              )
              .eq("teacher_id", profile.id)
              .order("created_at", { ascending: false });

          console.log(
            "Assignments found for teacher:",
            teacherAssignments?.length || 0
          );
          assignmentsData = teacherAssignments || [];
          error = teacherError;
        } else if (profile.role === "school_admin") {
          // For school admins: fetch all assignments from teachers in their school
          console.log(
            "Fetching all school assignments for school admin:",
            profile.school_id
          );

          const { data: schoolAssignments, error: schoolError } = await supabase
            .from("assignments")
            .select(
              `
              *,
              user_profiles!assignments_teacher_id_fkey(
                first_name,
                last_name
              )
            `
            )
            .eq("school_id", profile.school_id)
            .order("teacher_id", { ascending: true })
            .order("created_at", { ascending: false });

          console.log(
            "School assignments found:",
            schoolAssignments?.length || 0
          );
          assignmentsData = schoolAssignments || [];
          error = schoolError;
        } else if (profile.role === "district_admin") {
          // For district admins: fetch all assignments in their district
          console.log(
            "Fetching all district assignments for district admin:",
            profile.district_id
          );

          const { data: districtAssignments, error: districtError } =
            await supabase
              .from("assignments")
              .select(
                `
              *,
              user_profiles!assignments_teacher_id_fkey(
                first_name,
                last_name
              )
            `
              )
              .eq("district_id", profile.district_id)
              .order("school_id", { ascending: true })
              .order("teacher_id", { ascending: true })
              .order("created_at", { ascending: false });

          console.log(
            "District assignments found:",
            districtAssignments?.length || 0
          );
          assignmentsData = districtAssignments || [];
          error = districtError;
        }

        if (error) {
          console.error("Error fetching assignments:", error);
          setAssignments([]);
          setDataLoading(false);
          return;
        }

        // Get submission statistics for each assignment
        const transformedAssignments = await Promise.all(
          (assignmentsData || []).map(async (assignment: any) => {
            try {
              // Get submission count for this assignment
              const { data: submissions } = await supabase
                .from("student_assignment_progress")
                .select("status")
                .eq("assignment_id", assignment.id);

              const submissionsCount =
                submissions?.filter((s: any) => s.status === "submitted")
                  .length || 0;
              const totalStudents = submissions?.length || 0;

              return {
                id: assignment.id,
                title: assignment.title,
                description: assignment.description,
                subject:
                  assignment.class_periods?.classes?.subjects?.name ||
                  "Subject",
                class_name: assignment.class_periods?.classes?.name || "Class",
                period: assignment.class_periods?.period || "",
                teacher_name: assignment.user_profiles
                  ? `${assignment.user_profiles.first_name} ${assignment.user_profiles.last_name}`
                  : "Teacher",
                due_date: assignment.due_date,
                created_at: assignment.created_at,
                status: "active",
                submissions_count: submissionsCount,
                total_students: totalStudents,
              };
            } catch (error) {
              console.error(
                `Error fetching submission stats for assignment ${assignment.id}:`,
                error
              );
              return {
                id: assignment.id,
                title: assignment.title,
                description: assignment.description,
                subject: "Subject",
                class_name: "Class",
                period: "",
                teacher_name: "Teacher",
                due_date: assignment.due_date,
                created_at: assignment.created_at,
                status: "active",
                submissions_count: 0,
                total_students: 0,
              };
            }
          })
        );

        setAssignments(transformedAssignments);
      } catch (error) {
        console.error("Error in fetchAssignments:", error);
        setAssignments([]);
      } finally {
        setDataLoading(false);
      }
    };

    fetchAssignments();
  }, [profile, user, supabase]);

  // Show loading while auth or data is loading
  if (loading || dataLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600">Loading assignments...</span>
        </div>
      </div>
    );
  }

  // Don't render if not authorized (redirect should handle this)
  if (!user || !profile) {
    return null;
  }

  return (
    <AssignmentsList
      assignments={assignments}
      currentUserRole={profile.role}
      currentUserSchool={(profile as any).schools}
      districtName={(profile as any).districts?.name || "District"}
      logo_url={(profile as any).districts?.logo_url || null}
      primary_color={(profile as any).districts?.primary_color || null}
      secondary_color={(profile as any).districts?.secondary_color || null}
      schoolBranding={profile.role === "school_admin" ? {
        primary_color: (profile as any).schools?.primary_color || null,
        secondary_color: (profile as any).schools?.secondary_color || null,
        logo_url: (profile as any).schools?.logo_url || null,
      } : undefined}
    />
  );
}
