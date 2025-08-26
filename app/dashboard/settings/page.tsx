// app/dashboard/settings/page.tsx
"use client";

import { useAuth } from "@/components/auth/OptimizedAuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import DistrictSettingsForm from "@/components/dashboard/DistrictSettingsForm";
import SchoolSettingsForm from "@/components/dashboard/SchoolSettingsForm";

export default function SettingsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [district, setDistrict] = useState<any>(null);
  const [school, setSchool] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(false);
  
  // Fetch data when profile is available
  useEffect(() => {
    if (user && profile && profile.district_id && !dataLoading && (!district || (profile.role === "school_admin" && !school))) {
      setDataLoading(true);
      
      const supabase = createClient();
      
      // Always fetch district data (needed for fallback colors/logo)
      const fetchDistrict = supabase
        .from("districts")
        .select("*")
        .eq("id", profile.district_id)
        .single();
      
      // Fetch school data if user is a school admin
      const fetchSchool = profile.role === "school_admin" && profile.school_id
        ? supabase
            .from("schools")
            .select("id, district_id, name, address, settings, created_at, updated_at, primary_color, secondary_color, logo_url")
            .eq("id", profile.school_id)
            .single()
        : Promise.resolve({ data: null, error: null });
      
      Promise.all([fetchDistrict, fetchSchool])
        .then(([districtResult, schoolResult]) => {
          if (districtResult.error) {
            console.error("Error fetching district:", districtResult.error);
          } else {
            setDistrict(districtResult.data);
          }
          
          if (schoolResult.error) {
            console.error("Error fetching school:", schoolResult.error);
          } else if (schoolResult.data) {
            setSchool(schoolResult.data);
          }
          
          setDataLoading(false);
        });
    }
  }, [user, profile, district, school, dataLoading]);

  // Redirect if not district or school admin
  useEffect(() => {
    if (!loading && profile && !["district_admin", "school_admin"].includes(profile.role)) {
      router.replace("/dashboard");
    }
  }, [profile, loading, router]);

  // Show loading while checking auth
  if (loading || !user || !profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600">Loading settings...</span>
        </div>
      </div>
    );
  }

  // Check if user has access to settings
  if (!["district_admin", "school_admin"].includes(profile.role)) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
        <p className="text-gray-600">
          Only district and school administrators can access settings.
        </p>
      </div>
    );
  }

  // Show loading while fetching data
  if (dataLoading || !district || (profile.role === "school_admin" && !school)) {
    const isSchoolAdmin = profile.role === "school_admin";
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isSchoolAdmin ? "School Settings" : "District Settings"}
          </h1>
          <p className="text-gray-600 mt-1">
            {isSchoolAdmin 
              ? "Manage your school information and preferences"
              : "Manage your district information and preferences"
            }
          </p>
        </div>
        
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-gray-600">
              Loading {isSchoolAdmin ? "school" : "district"} information...
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Render appropriate settings form based on user role
  const isSchoolAdmin = profile.role === "school_admin";
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {isSchoolAdmin ? "School Settings" : "District Settings"}
        </h1>
        <p className="text-gray-600 mt-1">
          {isSchoolAdmin 
            ? "Manage your school information and preferences"
            : "Manage your district information and preferences"
          }
        </p>
      </div>

      {/* Settings Form */}
      {isSchoolAdmin ? (
        <SchoolSettingsForm 
          school={school} 
          district={district}
          userProfile={profile}
        />
      ) : (
        <DistrictSettingsForm 
          district={district} 
          userProfile={profile}
        />
      )}
    </div>
  );
}
