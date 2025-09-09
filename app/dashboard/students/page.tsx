//  app/dashboard/students/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/OptimizedAuthProvider";
import { createClient } from "@/lib/supabase";
import StudentsList from "@/components/dashboard/students/StudentsList";

export default function StudentsPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      // Wait for authentication to be resolved
      if (loading) {
        return;
      }

      // Check authentication and permissions
      if (!user) {
        router.replace("/");
        return;
      }

      if (!profile || !profile.district_id) {
        router.replace("/");
        return;
      }

      // Only district admins, school admins, and teachers can access this page
      if (!["district_admin", "school_admin", "teacher"].includes(profile.role)) {
        router.replace("/dashboard");
        return;
      }

      try {
        const supabase = createClient();

        // Build query based on user role
        let studentsQuery = supabase
          .from("user_profiles")
          .select(`
            *,
            schools:school_id(id, name)
          `)
          .eq("role", "student")
          .eq("district_id", profile.district_id);

        // School admins and teachers can only see students from their school
        if (
          (profile.role === "school_admin" || profile.role === "teacher") &&
          profile.school_id
        ) {
          studentsQuery = studentsQuery.eq("school_id", profile.school_id);
        }

        const { data: studentsData, error: studentsError } = await studentsQuery.order(
          "created_at",
          { ascending: false }
        );

        if (studentsError) {
          console.error("Error fetching students:", studentsError);
          setError("Failed to fetch students data");
        } else {
          setStudents(studentsData || []);
        }

        // Fetch schools for filtering (district admins only)
        if (profile.role === "district_admin") {
          const { data: schoolsData, error: schoolsError } = await supabase
            .from("schools")
            .select("id, name")
            .eq("district_id", profile.district_id)
            .order("name");

          if (schoolsError) {
            console.error("Error fetching schools:", schoolsError);
          } else {
            setSchools(schoolsData || []);
          }
        }
      } catch (err) {
        console.error("Error in fetchData:", err);
        setError("An unexpected error occurred");
      } finally {
        setDataLoading(false);
      }
    }

    fetchData();
  }, [user, profile, loading, router]);

  if (loading || dataLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading students...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading students</p>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null; // Will redirect via useEffect
  }

  return (
    <StudentsList
      students={students}
      schools={schools}
      currentUserRole={profile.role}
      currentUserSchool={profile.schools}
      districtName={profile.districts?.name || "District"}
      districtBranding={{
        primary_color: profile.districts?.primary_color || null,
        secondary_color: profile.districts?.secondary_color || null,
        logo_url: profile.districts?.logo_url || null,
      }}
      schoolBranding={profile.role === "school_admin" && profile.schools ? {
        primary_color: profile.schools.primary_color || null,
        secondary_color: profile.schools.secondary_color || null,
        logo_url: profile.schools.logo_url || null,
      } : undefined}
    />
  );
}