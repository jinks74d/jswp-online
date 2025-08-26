// app/dashboard/classes/page.tsx
"use client";

import { useAuth } from "@/components/auth/OptimizedAuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import ClassesList from "@/components/dashboard/classes/ClassesList";

export default function ClassesPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [classPeriods, setClassPeriods] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const supabase = createClient();

  // Redirect if not authorized
  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.replace("/");
      return;
    }
  }, [user, profile, loading, router]);

  // Fetch class periods data function
  const fetchClassPeriods = useCallback(async () => {
    if (!profile || !user) {
      return;
    }
    try {
      setDataLoading(true);
      let classPeriodsData;
      let classPeriodsError;

      if (profile.role === "teacher") {
        // For teachers, only show classes they're assigned to
        const { data, error } = await supabase
          .from("class_teacher_assignments")
          .select(
            `
              *,
              class_period:class_period_id(
                *,
                classes:class_id(
                  id,
                  name,
                  subjects:subject_id(
                    id,
                    name
                  )
                )
              )
            `
          )
          .eq("teacher_id", user.id)
          .order("created_at");

        classPeriodsData =
          data?.map((assignment: any) => assignment.class_period) || [];
        classPeriodsError = error;
      } else {
        // For admins, show all classes in the school
        const { data, error } = await supabase
          .from("class_periods")
          .select(
            `
              *,
              classes:class_id(
                id,
                name,
                subjects:subject_id(
                  id,
                  name
                )
              )
            `
          )
          .eq("school_id", profile.school_id)
          .order("period");

        classPeriodsData = data;
        classPeriodsError = error;
      }

      if (classPeriodsError) {
        console.error("Error fetching class periods:", classPeriodsError);
        setClassPeriods([]);
        setDataLoading(false);
        return;
      }

      // Get student enrollment counts for each class period
      if (classPeriodsData && classPeriodsData.length > 0) {
        const classPeriodsWithCounts = await Promise.all(
          classPeriodsData.map(async (classPeriod: any) => {
            try {
              const { count } = await supabase
                .from("class_student_enrollments")
                .select("*", { count: "exact", head: true })
                .eq("class_period_id", classPeriod.id);

              return {
                ...classPeriod,
                studentCount: count || 0,
              };
            } catch (error) {
              console.error(
                `Error fetching student count for class ${classPeriod.id}:`,
                error
              );
              return {
                ...classPeriod,
                studentCount: 0,
              };
            }
          })
        );

        setClassPeriods(classPeriodsWithCounts);
      } else {
        setClassPeriods([]);
      }
    } catch (error) {
      console.error("Error in fetchClassPeriods:", error);
      setClassPeriods([]);
    } finally {
      setDataLoading(false);
    }
  }, [profile, user, supabase]);

  // Effect to fetch data on component mount
  useEffect(() => {
    fetchClassPeriods();
  }, [fetchClassPeriods]);

  const handleRefresh = () => {
    fetchClassPeriods();
  };

  // Show loading while auth or data is loading
  if (loading || dataLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600">Loading classes...</span>
        </div>
      </div>
    );
  }

  // Don't render if not authorized (redirect should handle this)
  if (!user || !profile) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Classes</h1>
        <p className="text-gray-600 mt-1">
          Manage class periods and schedules for{" "}
          {(profile as any).schools?.name || "your school"}
        </p>
      </div>

      {/* Classes List */}
      <ClassesList
        classPeriods={classPeriods}
        profile={profile as any}
        districtBranding={{
          logo_url: (profile as any).districts?.logo_url || null,
          primary_color: (profile as any).districts?.primary_color || null,
          secondary_color: (profile as any).districts?.secondary_color || null,
        }}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
