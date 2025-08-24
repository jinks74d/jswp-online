// components/dashboard/ClientDashboardPage.tsx
"use client";

import { useAuth } from "@/app/dashboard/auth-provider";
import DistrictAdminDashboard from "./DistrictAdminDashboard";
import SchoolAdminDashboard from "./SchoolAdminDashboard";
import TeacherDashboard from "./TeacherDashboard";
import StudentDashboard from "./StudentDashboard";

export function ClientDashboardPage() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
        <p className="text-gray-600">Please log in to access your dashboard.</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-yellow-600 mb-4">
          Profile Not Found
        </h1>
        <p className="text-gray-600">
          Unable to load your profile information.
        </p>
      </div>
    );
  }

  // Render role-specific dashboard
  const renderDashboard = () => {
    switch (profile.role) {
      case "district_admin":
        return <DistrictAdminDashboard profile={profile as any} />;

      case "school_admin":
        return <SchoolAdminDashboard profile={profile as any} />;

      case "teacher":
        return <TeacherDashboard profile={profile as any} />;

      case "student":
        return <StudentDashboard profile={profile as any} />;

      default:
        return (
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Welcome to JSWP Online
            </h1>
            <p className="text-gray-600 mb-4">
              Hello {profile.first_name || profile.email}!
            </p>
            <p className="text-gray-500">
              Your dashboard is being prepared for role: {profile.role}
            </p>
          </div>
        );
    }
  };

  return renderDashboard();
}
