// components/super-admin/ClientSuperAdmin.tsx
"use client";

import { useAuth } from "@/app/dashboard/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import SuperAdminSidebar from "./SuperAdminSidebar";

interface ClientSuperAdminProps {
  children: React.ReactNode;
}

export function ClientSuperAdmin({ children }: ClientSuperAdminProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  // Redirect logic - only for role-based routing, not auth failures  
  useEffect(() => {
    // Only redirect non-super-admins to dashboard - no auth failure redirects
    if (!loading && user && profile && profile.role !== "super_admin") {
      console.log('ClientSuperAdmin: Non-super-admin detected, redirecting to dashboard');
      router.replace('/dashboard');
      return;
    }
  }, [user, profile, loading, router]);

  // Show loading while auth is being determined
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Authenticating super admin...</p>
          <p className="text-sm text-gray-500 mt-2">Please wait while we verify your session</p>
        </div>
      </div>
    );
  }

  // Show loading if no profile yet
  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading super admin profile...</p>
          <p className="text-sm text-gray-500 mt-2">Setting up your admin dashboard</p>
        </div>
      </div>
    );
  }

  // Ensure user is actually a super admin
  if (profile.role !== "super_admin") {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl">!</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            You don&apos;t have super admin privileges. Please contact your system administrator.
          </p>
          <button
            onClick={() => router.replace('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SuperAdminSidebar profile={profile as any} />
      <div className="pl-64">
        <main className="py-8 px-8">{children}</main>
      </div>
    </div>
  );
}
