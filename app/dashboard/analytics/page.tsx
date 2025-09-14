"use client";

import { useAuth } from "@/components/auth/OptimizedAuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import EnhancedAnalyticsDashboard from "@/components/dashboard/analytics/EnhancedAnalyticsDashboard";

export default function AnalyticsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  // Redirect if not authorized
  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.replace("/");
      return;
    }

    // Only allow admins to access analytics
    if (
      !loading &&
      profile &&
      !["super_admin", "district_admin", "school_admin"].includes(profile.role)
    ) {
      router.replace("/dashboard");
      return;
    }
  }, [user, profile, loading, router]);

  // Show loading while auth is being determined
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600">Loading analytics...</span>
        </div>
      </div>
    );
  }

  // Don't render if not authorized (redirect should handle this)
  if (
    !user ||
    !profile ||
    !["super_admin", "district_admin", "school_admin"].includes(profile.role)
  ) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <EnhancedAnalyticsDashboard
        userRole={profile.role}
        districtId={profile.district_id || undefined}
        schoolId={profile.school_id || undefined}
        districtName={(profile as any).districts?.name || undefined}
        schoolName={(profile as any).schools?.name || undefined}
        logo_url={(profile as any).districts?.logo_url || null}
        primary_color={(profile as any).districts?.primary_color || null}
        secondary_color={(profile as any).districts?.secondary_color || null}
        schoolBranding={
          profile.role === "school_admin"
            ? {
                primary_color: (profile as any).schools?.primary_color || null,
                secondary_color:
                  (profile as any).schools?.secondary_color || null,
                logo_url: (profile as any).schools?.logo_url || null,
              }
            : undefined
        }
      />
    </div>
  );
}
