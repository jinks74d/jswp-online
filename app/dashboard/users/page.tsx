// app/dashboard/users/page.tsx
"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import UsersList from "@/components/dashboard/users/UsersList";

export default function UsersPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const supabase = createClient();

  // Redirect if not authorized
  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.replace('/');
      return;
    }

    // Only district and school admins can manage users
    if (!loading && profile && !["district_admin", "school_admin"].includes(profile.role)) {
      router.replace('/dashboard');
      return;
    }
  }, [user, profile, loading, router]);

  // Fetch users and schools data
  useEffect(() => {
    if (!profile || !profile.district_id || !["district_admin", "school_admin"].includes(profile.role)) {
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch users for this district (or school for school admins)
        let usersQuery = supabase
          .from("user_profiles")
          .select(
            `
            *,
            schools:school_id(id, name)
          `
          )
          .eq("district_id", profile.district_id)
          .order("created_at", { ascending: false });

        // School admins can only see users from their school
        if (profile.role === "school_admin" && profile.school_id) {
          usersQuery = usersQuery.eq("school_id", profile.school_id);
        }

        const { data: usersData, error: usersError } = await usersQuery;

        if (usersError) {
          console.error("Error fetching users:", usersError);
          setUsers([]);
        } else {
          setUsers(usersData || []);
        }

        // Fetch schools for the district (for district admins)
        let schoolsData: any[] = [];
        if (profile.role === "district_admin") {
          const { data: schoolsResult, error: schoolsError } = await supabase
            .from("schools")
            .select("id, name")
            .eq("district_id", profile.district_id)
            .order("name");

          if (schoolsError) {
            console.error("Error fetching schools:", schoolsError);
          } else {
            schoolsData = schoolsResult || [];
          }
        }
        setSchools(schoolsData);

      } catch (error) {
        console.error("Error in fetchData:", error);
        setUsers([]);
        setSchools([]);
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [profile, supabase]);

  // Show loading while auth or data is loading
  if (loading || dataLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600">Loading users...</span>
        </div>
      </div>
    );
  }

  // Don't render if not authorized (redirect should handle this)
  if (!user || !profile || !["district_admin", "school_admin"].includes(profile.role)) {
    return null;
  }

  return (
    <UsersList
      users={users}
      schools={schools}
      currentUserRole={profile.role}
      districtName={(profile as any).districts?.name || "District"}
      districtBranding={{
        logo_url: (profile as any).districts?.logo_url || null,
        primary_color: (profile as any).districts?.primary_color || null,
        secondary_color: (profile as any).districts?.secondary_color || null,
      }}
      schoolBranding={profile.role === "school_admin" ? {
        primary_color: (profile as any).schools?.primary_color || null,
        secondary_color: (profile as any).schools?.secondary_color || null,
        logo_url: (profile as any).schools?.logo_url || null,
      } : undefined}
    />
  );
}
