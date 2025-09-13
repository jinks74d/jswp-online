// components/dashboard/ClientDashboard.tsx
"use client";

import { useAuth } from "@/components/auth/OptimizedAuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, memo, useCallback } from "react";
import DashboardSidebar from "./DashboardSidebar";

interface ClientDashboardProps {
  children: React.ReactNode;
}

function ClientDashboard({ children }: ClientDashboardProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [redirectDelay, setRedirectDelay] = useState(true);
  const mountedRef = useRef(true);
  const redirectHandledRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Handle super admin redirect - only once
  useEffect(() => {
    if (
      !loading &&
      user &&
      profile &&
      profile.role === "super_admin" &&
      !redirectHandledRef.current
    ) {
      redirectHandledRef.current = true;
      router.replace("/super-admin");
    }
  }, [loading, user, profile, router]);

  // Add delay on initial load to give session time to restore
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        setRedirectDelay(false);
      }
    }, 2000); // Wait 2 seconds before allowing redirects

    return () => clearTimeout(timer);
  }, []);

  // Memoized redirect to login handler
  const handleLoginRedirect = useCallback(() => {
    if (!redirectHandledRef.current) {
      redirectHandledRef.current = true;
      console.log(
        "ClientDashboard: No authentication data found after waiting, redirecting to login"
      );
      router.replace("/");
    }
  }, [router]);

  // Show loading state during initial auth check
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
          <p className="text-xs text-gray-500 mt-2">
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

  // Only redirect if auth is complete AND we have no user AND we've waited long enough
  if (!loading && !user && !redirectDelay) {
    handleLoginRedirect();
    return null;
  }

  // Show loading if we're still in redirect delay
  if (redirectDelay) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Check if user has district access
  if (profile && !profile.district_id) {
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

  // Create gradient style with district primary color
  const districtPrimaryColor = profile?.districts?.primary_color || "#3B82F6";
  const gradientStyle = {
    background: `linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 50%, ${districtPrimaryColor} 100%)`,
  };

  return (
    <div
      className="min-h-screen transition-opacity duration-300 opacity-100"
      style={gradientStyle}
    >
      <DashboardSidebar profile={profile!} />
      <div className="pl-64">
        <main className="py-8 px-8">{children}</main>
      </div>
    </div>
  );
}

// Memoized export for better performance
export default memo(ClientDashboard);
