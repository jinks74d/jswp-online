// components/dashboard/analytics/AnalyticsDashboard.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  Users,
  Activity,
  TrendingUp,
  Monitor,
  Smartphone,
  Tablet,
  BarChart3,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useErrorHandler } from "@/components/error/ErrorProvider";
import { useAsyncHandler } from "@/lib/async-handler";
import { AppError, ErrorType } from "@/lib/errors";

interface AnalyticsData {
  summary: {
    totalSessions: number;
    uniqueUsers: number;
    currentActiveUsers: number;
    averageSessionMinutes: number;
    totalHours: number;
    totalPageViews: number;
    totalActions: number;
    timeRange: string;
    dateRange: {
      start: string;
      end: string;
    };
    teacherTotals?: {
      users: number;
      sessions: number;
      totalHours: number;
      totalMinutes: number;
      averageMinutes: number;
    };
    studentTotals?: {
      users: number;
      sessions: number;
      totalHours: number;
      totalMinutes: number;
      averageMinutes: number;
    };
  };
  breakdown: {
    roles: { [key: string]: { count: number; minutes: number } };
    devices: { [key: string]: number };
    schools?: {
      [key: string]: {
        name: string;
        teachers: { count: number; sessions: number; minutes: number };
        students: { count: number; sessions: number; minutes: number };
        totals: { count: number; sessions: number; minutes: number };
      };
    };
  };
  daily: Array<{
    date: string;
    sessions: number;
    uniqueUsers: number;
    totalMinutes: number;
    averageMinutes: number;
  }>;
  scope: {
    level: string;
    districtId: string | null;
    schoolId: string | null;
  };
  tablesMissing?: boolean;
}

interface AnalyticsDashboardProps {
  userRole: string;
  districtId?: string;
  schoolId?: string;
  districtName?: string;
  schoolName?: string;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  schoolBranding?: {
    primary_color?: string | null;
    secondary_color?: string | null;
    logo_url?: string | null;
  };
}

export default function AnalyticsDashboard({
  userRole,
  districtId,
  schoolId,
  districtName,
  schoolName,
  logo_url,
  primary_color,
  secondary_color,
  schoolBranding,
}: AnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7d");
  const [level, setLevel] = useState(() => {
    // Set appropriate default level based on user role
    if (userRole === "school_admin") return "school";
    if (userRole === "district_admin") return "district";
    return "auto";
  });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // District branding
  // School branding with district fallback
  const schoolSecondaryColor =
    schoolBranding?.secondary_color || secondary_color || "#0B2559";

  // Main analytics fetch
  useEffect(() => {
    fetchAnalytics();
  }, [timeRange, level, districtId, schoolId]);

  // Set initial update time and real-time active users update every 30 seconds
  useEffect(() => {
    setLastUpdate(new Date());

    const interval = setInterval(() => {
      fetchActiveUsers();
      setLastUpdate(new Date());
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [level, districtId, schoolId]);

  const { execute } = useAsyncHandler();
  const { reportError } = useErrorHandler();

  const fetchAnalytics = async () => {
    setLoading(true);

    const result = await execute(
      async () => {
        const params = new URLSearchParams({
          range: timeRange,
          level: level,
        });

        // Always pass district_id if available
        if (districtId) {
          params.append("district_id", districtId);
        }

        // Always pass school_id for school admins, or when level is school
        if (
          (userRole === "school_admin" && schoolId) ||
          (level === "school" && schoolId)
        ) {
          params.append("school_id", schoolId);
        }

        const response = await fetch(`/api/analytics/dashboard?${params}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new AppError({
            type:
              response.status === 401
                ? ErrorType.AUTHENTICATION_FAILED
                : response.status === 403
                ? ErrorType.AUTHORIZATION_DENIED
                : response.status === 503
                ? ErrorType.TABLE_NOT_FOUND
                : ErrorType.API_REQUEST_FAILED,
            message:
              errorData.details ||
              `Analytics request failed with status ${response.status}`,
            context: {
              metadata: {
                status: response.status,
                params: params.toString(),
                errorData,
              },
            },
          });
        }

        const data = await response.json();
        return data.data;
      },
      {
        operationName: "fetchAnalytics",
        timeout: 15000,
        retries: 1,
        context: { timeRange, level, districtId, schoolId },
        onError: (error) => {
          if (error.type === ErrorType.TABLE_NOT_FOUND) {
            // For missing tables, set empty analytics but don't show error toast
            setAnalytics({
              summary: {
                totalSessions: 0,
                uniqueUsers: 0,
                currentActiveUsers: 0,
                averageSessionMinutes: 0,
                totalHours: 0,
                totalPageViews: 0,
                totalActions: 0,
                timeRange,
                dateRange: {
                  start: new Date().toISOString(),
                  end: new Date().toISOString(),
                },
              },
              breakdown: { roles: {}, devices: {} },
              daily: [],
              scope: {
                level: "school",
                districtId: districtId || null,
                schoolId: schoolId || null,
              },
              tablesMissing: true,
            });
          } else {
            // For other errors, show error toast
            reportError(error);
          }
        },
      }
    );

    if (result.success && result.data) {
      setAnalytics(result.data);
    }

    setLoading(false);
  };

  const fetchActiveUsers = async () => {
    const result = await execute(
      async () => {
        const params = new URLSearchParams({
          range: "1d", // Only need current active users
          level: level,
        });

        // Always pass district_id if available
        if (districtId) {
          params.append("district_id", districtId);
        }

        // Always pass school_id for school admins, or when level is school
        if (
          (userRole === "school_admin" && schoolId) ||
          (level === "school" && schoolId)
        ) {
          params.append("school_id", schoolId);
        }

        const response = await fetch(`/api/analytics/dashboard?${params}`);

        if (!response.ok) {
          throw new AppError({
            type: ErrorType.API_REQUEST_FAILED,
            message: `Failed to fetch active users: ${response.status}`,
            context: {
              metadata: { status: response.status, params: params.toString() },
            },
          });
        }

        const data = await response.json();
        return data.data;
      },
      {
        operationName: "fetchActiveUsers",
        timeout: 10000,
        retries: 1,
        silent: true, // Don't show errors for background updates
        context: { level, districtId, schoolId },
      }
    );

    if (result.success && result.data && analytics) {
      // Only update the active users count, keep the rest of the data
      setAnalytics((prev) =>
        prev
          ? {
              ...prev,
              summary: {
                ...prev.summary,
                currentActiveUsers: result.data.summary.currentActiveUsers,
              },
            }
          : result.data
      );
    }
  };

  const getDeviceIcon = (device: string) => {
    switch (device.toLowerCase()) {
      case "mobile":
        return <Smartphone className="h-4 w-4" />;
      case "tablet":
        return <Tablet className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const getScopeTitle = () => {
    if (analytics?.scope.level === "school" && schoolName) {
      return `${schoolName} Analytics`;
    }
    if (analytics?.scope.level === "district" && districtName) {
      return `${districtName} Analytics`;
    }
    return "Platform Analytics";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-yellow-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Analytics Setup Required
          </h3>
          <p className="text-gray-600 mb-4">
            Analytics tables need to be created in the database to start
            tracking user activity.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
            <h4 className="font-medium text-blue-900 mb-2">
              Setup Instructions:
            </h4>
            <ol className="text-sm text-blue-800 space-y-1">
              <li>1. Go to your Supabase project dashboard</li>
              <li>2. Open the SQL Editor</li>
              <li>
                3. Run the migration:{" "}
                <code className="bg-blue-100 px-1 rounded">
                  migrations/create-analytics-schema.sql
                </code>
              </li>
              <li>4. Refresh this page</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getScopeTitle()}
          </h1>
          <p className="text-sm text-gray-500">
            {new Date(analytics.summary.dateRange.start).toLocaleDateString()} -{" "}
            {new Date(analytics.summary.dateRange.end).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center space-x-4">
          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="1d">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>

          {/* Level Selector (for super admins and district admins) */}
          {(userRole === "super_admin" || userRole === "district_admin") && (
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="auto">Auto</option>
              {userRole === "super_admin" && (
                <>
                  <option value="district">District Level</option>
                  <option value="school">School Level</option>
                </>
              )}
              {userRole === "district_admin" && (
                <option value="school">School Level</option>
              )}
            </select>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          className="bg-white p-6 rounded-lg shadow border-2"
          style={{ border: `2px solid ${schoolSecondaryColor}` }}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0 relative">
              <Users className="h-8 w-8 text-blue-600" />
              {analytics.summary.currentActiveUsers > 0 && (
                <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
              )}
            </div>
            <div className="ml-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-500">
                  Active Users
                </p>
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.summary.currentActiveUsers}
              </p>
              <p className="text-xs text-gray-400">
                {analytics.summary.uniqueUsers} total users
              </p>
              {lastUpdate && (
                <p className="text-xs text-gray-500 mt-1">
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </div>

        <div
          className="bg-white p-6 rounded-lg shadow border-2"
          style={{ border: `2px solid ${schoolSecondaryColor}` }}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg Session</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatDuration(analytics.summary.averageSessionMinutes)}
              </p>
              <p className="text-xs text-gray-400">
                {analytics.summary.totalHours}h total
              </p>
            </div>
          </div>
        </div>

        <div
          className="bg-white p-6 rounded-lg shadow border-2"
          style={{ border: `2px solid ${schoolSecondaryColor}` }}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Activity className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Sessions</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.summary.totalSessions}
              </p>
              <p className="text-xs text-gray-400">
                {analytics.summary.totalPageViews} page views
              </p>
            </div>
          </div>
        </div>

        <div
          className="bg-white p-6 rounded-lg shadow border-2"
          style={{ border: `2px solid ${schoolSecondaryColor}` }}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="h-8 w-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">User Actions</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.summary.totalActions}
              </p>
              <p className="text-xs text-gray-400">
                {Math.round(
                  analytics.summary.totalActions /
                    analytics.summary.uniqueUsers || 0
                )}{" "}
                per user
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Teacher/Student Breakdown for School Analytics */}
      {analytics.scope.level === "school" &&
        analytics.summary.teacherTotals &&
        analytics.summary.studentTotals && (
          <div
            className="bg-white p-6 rounded-lg shadow border-2"
            style={{ border: `2px solid ${schoolSecondaryColor}` }}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              School Usage Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Teachers Summary */}
              <div className="border-r border-gray-200 pr-6 md:pr-6 md:border-r md:border-gray-200">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0">
                    <div className="w-4 h-4 bg-blue-500 rounded-full mr-3"></div>
                  </div>
                  <h4 className="text-lg font-medium text-gray-900">
                    Teachers
                  </h4>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Active Users:</span>
                    <span className="font-semibold text-gray-900">
                      {analytics.summary.teacherTotals.users}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">
                      Total Sessions:
                    </span>
                    <span className="font-semibold text-gray-900">
                      {analytics.summary.teacherTotals.sessions}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Time:</span>
                    <span className="font-semibold text-gray-900">
                      {analytics.summary.teacherTotals.totalHours}h{" "}
                      {analytics.summary.teacherTotals.totalMinutes % 60}m
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg Session:</span>
                    <span className="font-semibold text-gray-900">
                      {formatDuration(
                        analytics.summary.teacherTotals.averageMinutes
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Students Summary */}
              <div className="pl-0 md:pl-6">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0">
                    <div className="w-4 h-4 bg-green-500 rounded-full mr-3"></div>
                  </div>
                  <h4 className="text-lg font-medium text-gray-900">
                    Students
                  </h4>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Active Users:</span>
                    <span className="font-semibold text-gray-900">
                      {analytics.summary.studentTotals.users}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">
                      Total Sessions:
                    </span>
                    <span className="font-semibold text-gray-900">
                      {analytics.summary.studentTotals.sessions}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Time:</span>
                    <span className="font-semibold text-gray-900">
                      {analytics.summary.studentTotals.totalHours}h{" "}
                      {analytics.summary.studentTotals.totalMinutes % 60}m
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg Session:</span>
                    <span className="font-semibold text-gray-900">
                      {formatDuration(
                        analytics.summary.studentTotals.averageMinutes
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* District School Breakdown */}
      {analytics.scope.level === "district" && analytics.breakdown.schools && (
        <div
          className="bg-white p-6 rounded-lg shadow border-2"
          style={{ border: `2px solid ${schoolSecondaryColor}` }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-6">
            Schools in District
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    School
                  </th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-900">
                    Teachers
                  </th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-900">
                    Teacher Time
                  </th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-900">
                    Students
                  </th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-900">
                    Student Time
                  </th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-900">
                    Total Users
                  </th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-900">
                    Total Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(analytics.breakdown.schools)
                  .sort(
                    ([, a], [, b]) =>
                      (b.totals.minutes || 0) - (a.totals.minutes || 0)
                  )
                  .map(([schoolId, school]) => (
                    <tr
                      key={schoolId}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-4 px-4">
                        <div className="font-medium text-gray-900">
                          {school.name}
                        </div>
                      </td>
                      <td className="py-4 px-2 text-center">
                        <div className="flex items-center justify-center">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                          <span className="font-semibold text-gray-900">
                            {school.teachers.count}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-2 text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {Math.floor(school.teachers.minutes / 60)}h{" "}
                          {school.teachers.minutes % 60}m
                        </div>
                        <div className="text-xs text-gray-500">
                          {school.teachers.sessions} sessions
                        </div>
                      </td>
                      <td className="py-4 px-2 text-center">
                        <div className="flex items-center justify-center">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                          <span className="font-semibold text-gray-900">
                            {school.students.count}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-2 text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {Math.floor(school.students.minutes / 60)}h{" "}
                          {school.students.minutes % 60}m
                        </div>
                        <div className="text-xs text-gray-500">
                          {school.students.sessions} sessions
                        </div>
                      </td>
                      <td className="py-4 px-2 text-center">
                        <div className="font-semibold text-gray-900">
                          {school.totals.count}
                        </div>
                      </td>
                      <td className="py-4 px-2 text-center">
                        <div className="font-semibold text-blue-600">
                          {Math.floor(school.totals.minutes / 60)}h{" "}
                          {school.totals.minutes % 60}m
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Role Breakdown */}
        <div
          className="bg-white p-6 rounded-lg shadow border-2"
          style={{ border: `2px solid ${schoolSecondaryColor}` }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Usage by Role
          </h3>
          <div className="space-y-3">
            {Object.entries(analytics.breakdown.roles).map(([role, data]) => {
              const roleColor =
                role === "teacher"
                  ? "bg-blue-500"
                  : role === "student"
                  ? "bg-green-500"
                  : "bg-gray-500";
              return (
                <div key={role} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className={`w-3 h-3 ${roleColor} rounded-full mr-3`}
                    ></div>
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {role.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {data.count} users
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDuration(Math.round(data.minutes))}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Device Breakdown */}
        <div
          className="bg-white p-6 rounded-lg shadow border-2"
          style={{ border: `2px solid ${schoolSecondaryColor}` }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Device Types
          </h3>
          <div className="space-y-3">
            {Object.entries(analytics.breakdown.devices).map(
              ([device, count]) => (
                <div key={device} className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getDeviceIcon(device)}
                    <span className="text-sm font-medium text-gray-700 ml-3 capitalize">
                      {device}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {count}
                    </p>
                    <p className="text-xs text-gray-500">
                      {Math.round(
                        (count / analytics.summary.totalSessions) * 100
                      )}
                      %
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Daily Usage Chart */}
      <div
        className="bg-white p-6 rounded-lg shadow border-2"
        style={{ border: `2px solid ${schoolSecondaryColor}` }}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Daily Usage Trend
        </h3>
        <div className="overflow-x-auto">
          <div className="min-w-full">
            <div className="grid grid-cols-7 gap-2 text-xs text-gray-500 mb-2">
              {analytics.daily.slice(-7).map((day) => (
                <div key={day.date} className="text-center">
                  {new Date(day.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {analytics.daily.slice(-7).map((day) => (
                <div
                  key={day.date}
                  className="bg-gray-50 p-3 rounded text-center"
                >
                  <div className="text-lg font-bold text-blue-600">
                    {day.uniqueUsers}
                  </div>
                  <div className="text-xs text-gray-500">users</div>
                  <div className="text-sm text-gray-700 mt-1">
                    {formatDuration(day.averageMinutes)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      {analytics.daily.length > 0 && (
        <div
          className="bg-white p-6 rounded-lg shadow border-2"
          style={{ border: `2px solid ${schoolSecondaryColor}` }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Daily Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sessions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.daily
                  .slice(-10)
                  .reverse()
                  .map((day) => (
                    <tr key={day.date}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(day.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {day.uniqueUsers}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {day.sessions}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDuration(day.averageMinutes)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDuration(day.totalMinutes)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
