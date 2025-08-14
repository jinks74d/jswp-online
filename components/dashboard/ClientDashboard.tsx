// components/dashboard/ClientDashboard.tsx
"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import DashboardSidebar from "./DashboardSidebar";

interface ClientDashboardProps {
  children: React.ReactNode;
}

export function ClientDashboard({ children }: ClientDashboardProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [fullProfile, setFullProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [lastValidProfile, setLastValidProfile] = useState<any>(null);

  // Fetch full profile with district data when user and profile are available
  useEffect(() => {
    if (user && profile && !fullProfile && !profileLoading) {
      // Log the current state for debugging
      console.log("ClientDashboard: Starting full profile fetch", {
        userId: user.id,
        profileId: profile.id,
        hasDistrictId: !!profile.district_id,
        profileRole: profile.role,
      });

      setProfileLoading(true);

      const supabase = createClient();

      // Use a promise with timeout to avoid hanging
      const fetchWithTimeout = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error("Profile fetch timeout"));
        }, 5000);

        supabase
          .from("user_profiles")
          .select(
            `
            *,
            districts:district_id(id, name, primary_color, secondary_color, logo_url),
            schools:school_id(id, name)
          `
          )
          .eq("id", user.id)
          .single()
          .then((result: any) => {
            clearTimeout(timer);
            resolve(result);
          })
          .catch((error: any) => {
            clearTimeout(timer);
            reject(error);
          });
      });

      fetchWithTimeout
        .then(({ data, error }: any) => {
          if (error) {
            console.error("Error fetching full profile:", error);
            // Only fall back to basic profile if it has district_id
            if (profile?.district_id) {
              setFullProfile(profile);
            } else {
              console.error(
                "Basic profile also missing district_id, keeping loading state"
              );
              // Don't set fullProfile, let it stay null to trigger loading
            }
          } else {
            setFullProfile(data);
          }
          setProfileLoading(false);
        })
        .catch((error) => {
          console.error("Profile fetch timed out or failed:", error);
          // Only use basic profile on timeout if it has district_id
          if (profile?.district_id) {
            setFullProfile(profile);
          } else {
            console.error(
              "Basic profile missing district_id during timeout fallback"
            );
            // Don't set fullProfile, let it stay null to trigger loading
          }
          setProfileLoading(false);
        });
    }
  }, [user, profile, fullProfile, profileLoading]);

  // Track the last valid profile for use during temporary state transitions
  useEffect(() => {
    const profileToUse = fullProfile || profile;
    if (profileToUse && profileToUse.district_id) {
      setLastValidProfile(profileToUse);
    }
  }, [fullProfile, profile]);

  // Redirect logic - only for role-based routing, not auth failures
  useEffect(() => {
    // Only redirect super admins to their dashboard - no auth failure redirects
    if (!loading && user && profile && profile.role === "super_admin") {
      console.log(
        "ClientDashboard: Super admin detected, redirecting to super-admin"
      );
      router.replace("/super-admin");
      return;
    }
  }, [user, profile, loading, router]);

  // Only show loading during initial auth check - not for subsequent navigations
  if (loading && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your session...</p>
          <p className="text-sm text-gray-500 mt-2">
            Please wait while we verify your authentication
          </p>
        </div>
      </div>
    );
  }

  // If we have a user but no profile, and we're not already loading it, show minimal loading
  // However, if we have a fullProfile or lastValidProfile already loaded, don't show this loading state
  if (
    user &&
    !profile &&
    !profileLoading &&
    !fullProfile &&
    !lastValidProfile
  ) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Setting up your dashboard...</p>
        </div>
      </div>
    );
  }

  // Wait for profile loading to complete before checking district access
  if (profileLoading || (!fullProfile && user && profile && !profileLoading)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Ensure user has district access (use fullProfile if available, otherwise fallback to profile, then lastValidProfile)
  const profileToCheck = fullProfile || profile || lastValidProfile;

  // Only show the access restricted error if we have a profile but it genuinely lacks district_id
  // This prevents false positives during loading states
  // SAFETY CHECK: If basic profile has district_id, never show access restricted
  if (
    profileToCheck &&
    !profileToCheck.district_id &&
    !profile?.district_id &&
    !lastValidProfile?.district_id
  ) {
    console.error("User profile missing district_id:", {
      userId: user?.id,
      profileId: profileToCheck.id,
      hasDistrictId: !!profileToCheck.district_id,
      fullProfile: !!fullProfile,
      basicProfile: !!profile,
      basicProfileHasDistrictId: !!profile?.district_id,
    });

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl">!</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Access Restricted
          </h1>
          <p className="text-gray-600 mb-4">
            Your account is not associated with a district. Please contact your
            administrator.
          </p>
          <button
            onClick={() => router.replace("/")}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  // Use full profile if available, otherwise use basic profile, then fallback to lastValidProfile
  const profileToUse = fullProfile || profile || lastValidProfile;

  // Create gradient style with district primary color
  const districtPrimaryColor =
    profileToUse?.districts?.primary_color || "#3B82F6";
  const gradientStyle = {
    background: `linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 50%, ${districtPrimaryColor} 100%)`,
  };

  return (
    <div className="min-h-screen" style={gradientStyle}>
      <DashboardSidebar profile={profileToUse} />
      <div className="pl-64">
        <main className="py-8 px-8">{children}</main>
      </div>
    </div>
  );
}
