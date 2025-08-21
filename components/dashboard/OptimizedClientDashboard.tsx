// components/dashboard/OptimizedClientDashboard.tsx
"use client";

import { useAuth } from "@/components/auth/OptimizedAuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { UserProfile } from "@/lib/supabase";
import DashboardSidebar from "./DashboardSidebar";
import { LoadingSpinner } from "@/components/ui/LoadingStates";

interface OptimizedClientDashboardProps {
  children: React.ReactNode;
}

// Memoized loading component
const DashboardLoading = ({ message }: { message: string }) => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
    <div className="text-center">
      <LoadingSpinner size="lg" />
      <p className="text-gray-600 mt-4">{message}</p>
    </div>
  </div>
);

// Memoized error component  
const DashboardError = ({ title, message, onRetry }: { 
  title: string; 
  message: string; 
  onRetry: () => void; 
}) => (
  <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
    <div className="text-center max-w-md mx-auto p-6">
      <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-white text-xl">!</span>
      </div>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-600 mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mr-2"
      >
        Retry
      </button>
    </div>
  </div>
);

export const OptimizedClientDashboard = ({ children }: OptimizedClientDashboardProps) => {
  const { authState } = useAuth();
  const router = useRouter();
  const [enrichedProfile, setEnrichedProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Determine if we need to enrich the profile
  const needsEnrichment = useMemo(() => {
    if (authState.status !== 'authenticated') return false;
    const profile = authState.profile;
    return !profile.districts && profile.district_id;
  }, [authState]);

  // Optimized profile enrichment with proper cleanup
  const enrichProfile = useCallback(async (profile: UserProfile) => {
    if (!needsEnrichment) {
      setEnrichedProfile(profile);
      return;
    }

    // Cancel existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from("user_profiles")
        .select(`
          *,
          districts:district_id(id, name, primary_color, secondary_color, logo_url),
          schools:school_id(id, name)
        `)
        .eq("id", profile.id)
        .abortSignal(controller.signal)
        .single();

      if (controller.signal.aborted) return;

      if (error) throw error;
      
      setEnrichedProfile(data as UserProfile);
      setProfileError(null);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      
      console.warn('Profile enrichment failed:', error);
      // Fallback to basic profile
      setEnrichedProfile(profile);
      setProfileError('Failed to load additional profile data');
    }
  }, [needsEnrichment]);

  // Effect to handle profile enrichment
  useEffect(() => {
    if (authState.status === 'authenticated') {
      enrichProfile(authState.profile);
    } else {
      setEnrichedProfile(null);
      setProfileError(null);
    }
  }, [authState, enrichProfile]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Memoized redirect logic
  useEffect(() => {
    if (authState.status === 'authenticated' && authState.profile.role === 'super_admin') {
      router.replace('/super-admin');
    }
  }, [authState, router]);

  // Memoized retry handler
  const handleRetry = useCallback(() => {
    if (authState.status === 'authenticated') {
      enrichProfile(authState.profile);
    }
  }, [authState, enrichProfile]);

  // Early returns with proper loading states
  if (authState.status === 'loading') {
    return <DashboardLoading message="Loading your session..." />;
  }

  if (authState.status === 'error') {
    return (
      <DashboardError
        title="Authentication Error"
        message={authState.error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (authState.status === 'unauthenticated') {
    router.replace('/');
    return <DashboardLoading message="Redirecting to login..." />;
  }

  // Wait for profile enrichment if needed
  if (needsEnrichment && !enrichedProfile && !profileError) {
    return <DashboardLoading message="Loading your dashboard..." />;
  }

  const profileToUse = enrichedProfile || authState.profile;

  // Check district access
  if (!profileToUse.district_id) {
    return (
      <DashboardError
        title="Access Restricted"
        message="Your account is not associated with a district. Please contact your administrator."
        onRetry={() => router.replace('/')}
      />
    );
  }

  // Memoized gradient style
  const gradientStyle = useMemo(() => {
    const primaryColor = profileToUse.districts?.primary_color || "#3B82F6";
    return {
      background: `linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 50%, ${primaryColor} 100%)`,
    };
  }, [profileToUse.districts?.primary_color]);

  return (
    <div className="min-h-screen" style={gradientStyle}>
      <DashboardSidebar profile={profileToUse} />
      <div className="pl-64">
        <main className="py-8 px-8">
          {profileError && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-yellow-800 text-sm">{profileError}</p>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
};