// app/dashboard/schools/page.tsx
"use client";

import { useAuth } from "@/components/auth/OptimizedAuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import SchoolsList from "@/components/dashboard/schools/SchoolsList";

export default function SchoolsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [schools, setSchools] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const supabase = createClient();

  // Redirect if not authorized
  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.replace('/');
      return;
    }

    // Only district admins can manage schools
    if (!loading && profile && profile.role !== "district_admin") {
      router.replace('/dashboard');
      return;
    }
  }, [user, profile, loading, router]);

  // Fetch schools data
  useEffect(() => {
    if (!profile || !profile.district_id || profile.role !== "district_admin") {
      return;
    }

    const fetchSchools = async () => {
      try {
        // Fetch schools for this district
        const { data: schoolsData, error } = await supabase
          .from("schools")
          .select("*")
          .eq("district_id", profile.district_id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching schools:", error);
          setSchools([]);
          setDataLoading(false);
          return;
        }

        // Fetch user counts for each school
        const schoolsWithUserCounts = await Promise.all(
          (schoolsData || []).map(async (school: any) => {
            try {
              const { count } = await supabase
                .from("user_profiles")
                .select("*", { count: "exact", head: true })
                .eq("school_id", school.id);

              return {
                ...school,
                user_count: count || 0,
              };
            } catch (error) {
              console.error(
                `Error fetching user count for school ${school.id}:`,
                error
              );
              return {
                ...school,
                user_count: 0,
              };
            }
          })
        );

        setSchools(schoolsWithUserCounts);
      } catch (error) {
        console.error("Error in fetchSchools:", error);
        setSchools([]);
      } finally {
        setDataLoading(false);
      }
    };

    fetchSchools();
  }, [profile, supabase]);

  // Show loading while auth or data is loading
  if (loading || dataLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600">Loading schools...</span>
        </div>
      </div>
    );
  }

  // Don't render if not authorized (redirect should handle this)
  if (!user || !profile || profile.role !== "district_admin") {
    return null;
  }

  return (
    <SchoolsList
      schools={schools}
      districtName={(profile as any).districts?.name || "District"}
      districtBranding={{
        logo_url: (profile as any).districts?.logo_url || null,
        primary_color: (profile as any).districts?.primary_color || null,
        secondary_color: (profile as any).districts?.secondary_color || null,
      }}
    />
  );
}
