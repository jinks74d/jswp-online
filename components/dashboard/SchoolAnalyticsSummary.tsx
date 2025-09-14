// components/dashboard/SchoolAnalyticsSummary.tsx
"use client";

import { useState, useEffect } from "react";
import { Clock, TrendingUp, Users, Activity, ArrowUp, ArrowDown } from "lucide-react";
import Link from "next/link";
import { useAsyncHandler } from "@/lib/async-handler";
import { AppError, ErrorType } from "@/lib/errors";

interface AnalyticsSummaryData {
  currentActiveUsers: number;
  totalSessions: number;
  averageSessionMinutes: number;
  uniqueUsers: number;
  totalHours: number;
  weeklyGrowth: {
    users: number;
    sessions: number;
    engagement: number;
  };
  teacherTotals?: {
    users: number;
    totalHours: number;
    averageMinutes: number;
  };
  studentTotals?: {
    users: number;
    totalHours: number;
    averageMinutes: number;
  };
}

interface SchoolAnalyticsSummaryProps {
  districtId?: string;
  schoolId?: string;
  userRole: string;
  borderColor: string;
}

export default function SchoolAnalyticsSummary({
  districtId,
  schoolId,
  userRole,
  borderColor,
}: SchoolAnalyticsSummaryProps) {
  const [analytics, setAnalytics] = useState<AnalyticsSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const { execute } = useAsyncHandler();

  useEffect(() => {
    fetchAnalyticsSummary();
  }, [districtId, schoolId]);

  const fetchAnalyticsSummary = async () => {
    setLoading(true);

    const result = await execute(
      async () => {
        const params = new URLSearchParams({
          range: "7d",
          level: userRole === "school_admin" ? "school" : "district",
        });

        if (districtId) {
          params.append("district_id", districtId);
        }

        if (schoolId) {
          params.append("school_id", schoolId);
        }

        const response = await fetch(`/api/analytics/enhanced?${params}`);

        if (!response.ok) {
          throw new AppError({
            type: ErrorType.API_REQUEST_FAILED,
            message: `Failed to fetch analytics summary: ${response.status}`,
            context: { metadata: { params: params.toString() } },
          });
        }

        const data = await response.json();
        return data.data || data;
      },
      {
        operationName: "fetchAnalyticsSummary",
        timeout: 15000,
        retries: 1,
        silent: true, // Don't show errors for this summary widget
      }
    );

    if (result.success && result.data) {
      setAnalytics(result.data);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div
        className="bg-white rounded-lg shadow-sm p-6 animate-pulse"
        style={{ border: `2px solid ${borderColor}` }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 bg-gray-300 rounded w-32"></div>
          <div className="h-4 bg-gray-300 rounded w-20"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center space-y-3">
              <div className="w-16 h-16 bg-gray-300 rounded-lg mx-auto"></div>
              <div className="h-4 bg-gray-300 rounded w-24 mx-auto"></div>
              <div className="h-3 bg-gray-300 rounded w-20 mx-auto"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div
        className="bg-white rounded-lg shadow-sm p-6"
        style={{ border: `2px solid ${borderColor}` }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">School Analytics</h2>
          <Link
            href="/dashboard/analytics"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
          >
            <TrendingUp className="w-4 h-4" />
            Setup Analytics
          </Link>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-medium text-gray-900 mb-2">Analytics Setup Required</h3>
          <p className="text-sm text-gray-600 mb-4">
            Run the analytics migrations to start tracking usage data.
          </p>
          <Link
            href="/dashboard/analytics"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            View Setup Instructions →
          </Link>
        </div>
      </div>
    );
  }

  const formatGrowth = (value: number) => {
    const isPositive = value >= 0;
    return {
      value: Math.abs(value).toFixed(1),
      isPositive,
      icon: isPositive ? ArrowUp : ArrowDown,
      color: isPositive ? "text-green-600" : "text-red-600",
    };
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  return (
    <div
      className="bg-white rounded-lg shadow-sm p-6"
      style={{ border: `2px solid ${borderColor}` }}
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">School Analytics</h2>
        <Link
          href="/dashboard/analytics"
          className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
        >
          <TrendingUp className="w-4 h-4" />
          View Full Analytics
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Daily Usage */}
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
            <Clock className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="font-medium text-gray-900 mb-1">Daily Usage</h3>
          <div className="text-2xl font-bold text-green-600 mb-1">
            {formatDuration(analytics.averageSessionMinutes || 0)}
          </div>
          <p className="text-sm text-gray-600">avg session time</p>
          <div className="flex items-center justify-center gap-1 mt-2">
            {(() => {
              const growth = formatGrowth(analytics.weeklyGrowth?.engagement || 0);
              const GrowthIcon = growth.icon;
              return (
                <>
                  <GrowthIcon className={`w-3 h-3 ${growth.color}`} />
                  <span className={`text-xs ${growth.color}`}>
                    {growth.value}% vs last week
                  </span>
                </>
              );
            })()}
          </div>
        </div>

        {/* Performance */}
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="font-medium text-gray-900 mb-1">Total Sessions</h3>
          <div className="text-2xl font-bold text-blue-600 mb-1">
            {(analytics.totalSessions || 0).toLocaleString()}
          </div>
          <p className="text-sm text-gray-600">this week</p>
          <div className="flex items-center justify-center gap-1 mt-2">
            {(() => {
              const growth = formatGrowth(analytics.weeklyGrowth?.sessions || 0);
              const GrowthIcon = growth.icon;
              return (
                <>
                  <GrowthIcon className={`w-3 h-3 ${growth.color}`} />
                  <span className={`text-xs ${growth.color}`}>
                    {growth.value}% vs last week
                  </span>
                </>
              );
            })()}
          </div>
        </div>

        {/* Active Users */}
        <div className="text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
            <Users className="w-8 h-8 text-purple-600" />
            {(analytics.currentActiveUsers || 0) > 0 && (
              <div className="absolute w-3 h-3 bg-green-500 rounded-full -mt-6 ml-6 animate-pulse"></div>
            )}
          </div>
          <h3 className="font-medium text-gray-900 mb-1">Active Now</h3>
          <div className="text-2xl font-bold text-purple-600 mb-1">
            {analytics.currentActiveUsers || 0}
          </div>
          <p className="text-sm text-gray-600">users online</p>
          <div className="flex items-center justify-center gap-1 mt-2">
            {(() => {
              const growth = formatGrowth(analytics.weeklyGrowth?.users || 0);
              const GrowthIcon = growth.icon;
              return (
                <>
                  <GrowthIcon className={`w-3 h-3 ${growth.color}`} />
                  <span className={`text-xs ${growth.color}`}>
                    {growth.value}% vs last week
                  </span>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Additional Metrics Row */}
      {analytics.teacherTotals && analytics.studentTotals && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Teacher Activity */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Activity className="w-5 h-5 text-blue-600" />
                </div>
                <h4 className="font-medium text-gray-900">Teacher Activity</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Active Teachers:</span>
                  <span className="font-medium">{analytics.teacherTotals?.users || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Time:</span>
                  <span className="font-medium">{analytics.teacherTotals?.totalHours || 0}h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Avg Session:</span>
                  <span className="font-medium">
                    {formatDuration(analytics.teacherTotals?.averageMinutes || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Student Activity */}
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <h4 className="font-medium text-gray-900">Student Activity</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Active Students:</span>
                  <span className="font-medium">{analytics.studentTotals?.users || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Time:</span>
                  <span className="font-medium">{analytics.studentTotals?.totalHours || 0}h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Avg Session:</span>
                  <span className="font-medium">
                    {formatDuration(analytics.studentTotals?.averageMinutes || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}