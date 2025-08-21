"use client";

import { useAuth } from "../auth-provider";
import AnalyticsDashboard from "@/components/dashboard/analytics/AnalyticsDashboard";

export default function AnalyticsPage() {
  const { profile } = useAuth();

  // Only allow admins to access analytics
  if (!["super_admin", "district_admin", "school_admin"].includes(profile?.role || "")) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">You don't have permission to view analytics.</p>
      </div>
    );
  }

  return <AnalyticsDashboard />;
}