//  app/dashboard/teachers/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/OptimizedAuthProvider";
import { createClient } from "@/lib/supabase";
import TeachersList from "@/components/dashboard/teachers/TeachersList";

export default function TeachersPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [teachers, setTeachers] = useState<any[]>([]);
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
        let teachersQuery = supabase
          .from("user_profiles")
          .select(`
            *,
            schools:school_id(id, name)
          `)
          .eq("role", "teacher")
          .eq("district_id", profile.district_id);

        // School admins can only see teachers from their school
        if (profile.role === "school_admin" && profile.school_id) {
          teachersQuery = teachersQuery.eq("school_id", profile.school_id);
        }

        const { data: teachersData, error: teachersError } = await teachersQuery.order(
          "created_at",
          { ascending: false }
        );

        if (teachersError) {
          console.error("Error fetching teachers:", teachersError);
          setError("Failed to fetch teachers data");
        } else {
          setTeachers(teachersData || []);
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
          <p className="text-gray-600">Loading teachers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading teachers</p>
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
    <TeachersList
      teachers={teachers}
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