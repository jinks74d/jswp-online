// components/dashboard/ClientDashboard.tsx
"use client";

import { useAuth } from "@/components/auth/OptimizedAuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, memo, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import DashboardSidebar from "./DashboardSidebar";

interface ClientDashboardProps {
  children: React.ReactNode;
}

function ClientDashboard({ children }: ClientDashboardProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [fullProfile, setFullProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [lastValidProfile, setLastValidProfile] = useState<any>(null);
  const mountedRef = useRef(true);
  const profileFetchRef = useRef<AbortController | null>(null);

  // Optimized profile fetching with smart caching
  useEffect(() => {
    if (!user || !profile || fullProfile || profileLoading) {
      return;
    }

    // Skip full profile fetch if basic profile has all needed data
    if (profile.district_id && profile.districts) {
      setFullProfile(profile);
      return;
    }

    // Cancel any existing fetch
    if (profileFetchRef.current) {
      profileFetchRef.current.abort();
    }

    const abortController = new AbortController();
    profileFetchRef.current = abortController;

    setProfileLoading(true);

    const fetchFullProfile = async () => {
      try {
        const supabase = createClient();

        // Only fetch what we need - districts and schools data
        const { data, error } = await supabase
          .from("user_profiles")
          .select(
            `
            *,
            districts:district_id(id, name, primary_color, secondary_color, logo_url),
            schools:school_id(id, name)
          `
          )
          .eq("id", user.id)
          .abortSignal(abortController.signal)
          .single();

        if (abortController.signal.aborted || !mountedRef.current) {
          return;
        }

        if (error) {
          // Fallback to basic profile if it has district_id
          if (profile?.district_id) {
            setFullProfile(profile);
          }
        } else {
          setFullProfile(data);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        // Fallback to basic profile
        if (profile?.district_id && mountedRef.current) {
          setFullProfile(profile);
        }
      } finally {
        if (mountedRef.current) {
          setProfileLoading(false);
        }
      }
    };

    fetchFullProfile();

    return () => {
      abortController.abort();
    };
  }, [user, profile, fullProfile, profileLoading]);

  // Track the last valid profile for use during temporary state transitions
  useEffect(() => {
    const profileToUse = fullProfile || profile;
    if (profileToUse && profileToUse.district_id) {
      setLastValidProfile(profileToUse);
    }
  }, [fullProfile, profile]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (profileFetchRef.current) {
        profileFetchRef.current.abort();
      }
    };
  }, []);

  // Simplified redirect logic
  useEffect(() => {
    if (!loading && user && profile && profile.role === "super_admin") {
      router.replace("/super-admin");
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
  // Only show loading if we're actively loading and don't have valid profile data
  if (profileLoading && !fullProfile && !lastValidProfile) {
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

// Memoized export for better performance
export default memo(ClientDashboard);
