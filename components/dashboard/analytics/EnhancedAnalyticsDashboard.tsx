// components/dashboard/analytics/EnhancedAnalyticsDashboard.tsx
"use client";

import { useState, useEffect } from "react";
import { useErrorHandler } from "@/components/error/ErrorProvider";
import { useAsyncHandler } from "@/lib/async-handler";
import { AppError, ErrorType } from "@/lib/errors";
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
  Download,
  Calendar,
  AlertTriangle,
  Award,
  Target,
  School,
  BookOpen,
  UserCheck,
  UserX,
  TrendingDown,
  ChevronUp,
  ChevronDown,
  FileDown,
  Mail,
  Printer,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface EnhancedAnalyticsData {
  // Existing summary data
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

  // Engagement Metrics
  engagement: {
    loginFrequency: {
      daily: number;
      weekly: number;
      monthly: number;
      totalRegistered: number;
      percentageActive: {
        daily: number;
        weekly: number;
        monthly: number;
      };
    };
    assignmentCompletion: {
      onTime: number;
      late: number;
      missing: number;
      completionRate: number;
    };
    activityPatterns: {
      peakHours: Array<{ hour: number; sessions: number }>;
      peakDays: Array<{ day: string; sessions: number }>;
      averageSessionsPerDay: number;
    };
    userRetention: {
      inactive7Days: number;
      inactive14Days: number;
      inactive30Days: number;
      atRiskUsers: Array<{
        id: string;
        name: string;
        lastLogin: string;
        daysInactive: number;
        role: string;
      }>;
    };
  };

  // Performance Indicators
  performance: {
    schoolRankings: Array<{
      schoolId: string;
      schoolName: string;
      engagementScore: number;
      completionRate: number;
      avgTimeSpent: number;
      rank: number;
      trend: "up" | "down" | "stable";
    }>;
    teacherEffectiveness: Array<{
      teacherId: string;
      teacherName: string;
      studentCount: number;
      avgStudentEngagement: number;
      assignmentCompletionRate: number;
      avgResponseTime: number;
    }>;
    assignmentAnalytics: {
      mostPopular: Array<{
        id: string;
        title: string;
        completions: number;
        avgCompletionTime: number;
      }>;
      leastPopular: Array<{
        id: string;
        title: string;
        completions: number;
        avgCompletionTime: number;
      }>;
      averageCompletionTime: number;
    };
    studentProgress: {
      improving: number;
      stable: number;
      declining: number;
      averageGrowthRate: number;
    };
  };

  // Comparative Analytics
  comparative: {
    schoolComparisons: Array<{
      schoolId: string;
      schoolName: string;
      metrics: {
        engagement: number;
        completion: number;
        timeSpent: number;
      };
      vsDistrictAvg: {
        engagement: number;
        completion: number;
        timeSpent: number;
      };
    }>;
    growthTrends: {
      weekOverWeek: {
        users: number;
        sessions: number;
        engagement: number;
      };
      monthOverMonth: {
        users: number;
        sessions: number;
        engagement: number;
      };
      yearOverYear?: {
        users: number;
        sessions: number;
        engagement: number;
      };
    };
    gradeAnalytics: Array<{
      grade: string;
      studentCount: number;
      avgEngagement: number;
      avgTimeSpent: number;
      completionRate: number;
    }>;
  };

  // Resource Utilization
  resources: {
    featureUsage: Array<{
      feature: string;
      usageCount: number;
      uniqueUsers: number;
      percentageOfTotal: number;
    }>;
    contentAnalytics: Array<{
      resourceId: string;
      resourceName: string;
      accessCount: number;
      avgTimeSpent: number;
      userRating?: number;
    }>;
    deviceBreakdown: {
      devices: { [key: string]: number };
      browsers: { [key: string]: number };
      operatingSystems: { [key: string]: number };
    };
    bandwidthUsage?: {
      total: number;
      average: number;
      peak: number;
      bySchool?: { [key: string]: number };
    };
  };

  // Early Warning System
  warnings: {
    inactiveUsers: {
      students: Array<{
        id: string;
        name: string;
        school: string;
        lastLogin: string;
        daysInactive: number;
      }>;
      teachers: Array<{
        id: string;
        name: string;
        school: string;
        lastLogin: string;
        daysInactive: number;
      }>;
    };
    lowEngagementSchools: Array<{
      schoolId: string;
      schoolName: string;
      engagementRate: number;
      belowAverageBy: number;
    }>;
    teacherActivity: {
      notCreatingAssignments: Array<{
        teacherId: string;
        teacherName: string;
        lastAssignment: string;
        daysSinceLastAssignment: number;
      }>;
    };
    assignmentBacklog: {
      ungraded: number;
      overdue: number;
      avgDaysOverdue: number;
      byTeacher: Array<{
        teacherId: string;
        teacherName: string;
        ungradedCount: number;
        overdueCount: number;
      }>;
    };
  };

  // Existing breakdown and daily data
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
  
  // Setup status
  tablesMissing?: boolean;
}

interface EnhancedAnalyticsDashboardProps {
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

export default function EnhancedAnalyticsDashboard({
  userRole,
  districtId,
  schoolId,
  districtName,
  schoolName,
  logo_url,
  primary_color,
  secondary_color,
  schoolBranding,
}: EnhancedAnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [timeRange, setTimeRange] = useState("7d");
  const [level, setLevel] = useState(() => {
    // Set appropriate default level based on user role
    if (userRole === "school_admin") return "school";
    if (userRole === "district_admin") return "district";
    return "auto";
  });
  const [customDateRange, setCustomDateRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>("engagement");
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [exportFormat, setExportFormat] = useState<"csv" | "excel" | "pdf">("csv");
  const [loading, setLoading] = useState(true);
  const { execute } = useAsyncHandler();
  const { reportError } = useErrorHandler();

  const [analytics, setAnalytics] = useState<EnhancedAnalyticsData | null>(null);

  // Color scheme
  const brandColor = schoolBranding?.primary_color || primary_color || "#0B2559";
  const borderColor = schoolBranding?.secondary_color || secondary_color || "#1E40AF";

  // Export functions
  const handleExport = (format: "csv" | "excel" | "pdf") => {
    console.log(`Exporting data as ${format}`);
    // Implementation would go here
  };

  const handleScheduleReport = () => {
    console.log("Opening report scheduling dialog");
    // Implementation would go here
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper functions
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatPercentage = (value: number, showSign: boolean = false) => {
    const formatted = `${value.toFixed(1)}%`;
    if (showSign && value > 0) return `+${formatted}`;
    return formatted;
  };

  const getTrendIcon = (trend: "up" | "down" | "stable") => {
    if (trend === "up") return <ArrowUpRight className="w-4 h-4 text-green-500" />;
    if (trend === "down") return <ArrowDownRight className="w-4 h-4 text-red-500" />;
    return <span className="w-4 h-4 text-gray-400">—</span>;
  };

  // Tab navigation
  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "engagement", label: "Engagement", icon: Activity },
    { id: "performance", label: "Performance", icon: Award },
    { id: "comparative", label: "Comparative", icon: Target },
    { id: "resources", label: "Resources", icon: BookOpen },
    { id: "warnings", label: "Warnings", icon: AlertTriangle },
  ];

  // Fetch enhanced analytics data
  const fetchEnhancedAnalytics = async () => {
    setLoading(true);
    
    const result = await execute(
      async () => {
        const params = new URLSearchParams({
          range: timeRange,
          level: level,
        });

        if (districtId) {
          params.append("district_id", districtId);
        }

        if ((userRole === "school_admin" && schoolId) || (level === "school" && schoolId)) {
          params.append("school_id", schoolId);
        }

        if (customDateRange) {
          params.append("start_date", customDateRange.start);
          params.append("end_date", customDateRange.end);
        }

        const response = await fetch(`/api/analytics/enhanced?${params}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new AppError({
            type: response.status === 401
              ? ErrorType.AUTHENTICATION_FAILED
              : response.status === 403
              ? ErrorType.AUTHORIZATION_DENIED
              : ErrorType.API_REQUEST_FAILED,
            message: errorData.details || `Enhanced analytics request failed with status ${response.status}`,
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
        return data.data || data;
      },
      {
        operationName: "fetchEnhancedAnalytics",
        timeout: 30000,
        retries: 2,
        context: { timeRange, level, districtId, schoolId },
        onError: (error) => {
          reportError(error);
        },
      }
    );

    if (result.success && result.data) {
      setAnalytics(result.data);
    }

    setLoading(false);
  };

  // Fetch analytics data on component mount and when parameters change
  useEffect(() => {
    fetchEnhancedAnalytics();
  }, [timeRange, level, districtId, schoolId, customDateRange]);

  // Auto-refresh active users every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Only refresh active users count, not the entire dataset
      if (analytics) {
        // You could implement a lighter endpoint just for active users
        // For now, we'll just refresh the full dataset every 5 minutes
        const lastFetch = new Date().getTime();
        if (lastFetch % (5 * 60 * 1000) < 30000) {
          fetchEnhancedAnalytics();
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [analytics]);

  if (loading || !analytics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  // Show setup message if tables are missing
  if (analytics.tablesMissing) {
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
            Analytics tables need to be created in the database to start tracking user activity.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
            <h4 className="font-medium text-blue-900 mb-2">Setup Instructions:</h4>
            <ol className="text-sm text-blue-800 space-y-1">
              <li>1. Go to your Supabase project dashboard</li>
              <li>2. Open the SQL Editor</li>
              <li>3. Run the migration: <code className="bg-blue-100 px-1 rounded">migrations/create-analytics-schema.sql</code></li>
              <li>4. Run the functions: <code className="bg-blue-100 px-1 rounded">migrations/create-enhanced-analytics-functions.sql</code></li>
              <li>5. Refresh this page</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {districtName} District Analytics
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Comprehensive analytics and insights for your district
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Time Range Selector */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="1d">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="1y">Last Year</option>
              <option value="custom">Custom Range</option>
            </select>

            {/* Export Options */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleExport("csv")}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                title="Export as CSV"
              >
                <FileDown className="w-5 h-5" />
              </button>
              <button
                onClick={handleScheduleReport}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                title="Schedule Report"
              >
                <Mail className="w-5 h-5" />
              </button>
              <button
                onClick={handlePrint}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                title="Print Report"
              >
                <Printer className="w-5 h-5" />
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => window.location.reload()}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center py-2 px-1 border-b-2 font-medium text-sm
                    ${
                      activeTab === tab.id
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }
                  `}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow border-2" style={{ borderColor }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Active Users</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {analytics.summary.uniqueUsers.toLocaleString()}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    +{analytics.comparative.growthTrends.weekOverWeek.users}% from last week
                  </p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border-2" style={{ borderColor }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Completion Rate</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {analytics.engagement.assignmentCompletion.completionRate}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {analytics.engagement.assignmentCompletion.onTime} on time
                  </p>
                </div>
                <Target className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border-2" style={{ borderColor }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Avg Session Time</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatDuration(analytics.summary.averageSessionMinutes)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {analytics.summary.totalHours.toLocaleString()} total hours
                  </p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border-2" style={{ borderColor }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">At-Risk Users</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {analytics.engagement.userRetention.inactive7Days}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    Inactive for 7+ days
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </div>
          </div>

          {/* Teacher vs Student Summary */}
          <div className="bg-white p-6 rounded-lg shadow border-2" style={{ borderColor }}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Teacher vs Student Usage
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border-r border-gray-200 pr-6">
                <div className="flex items-center mb-4">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  <h4 className="text-md font-medium text-gray-900">Teachers</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Active Users:</span>
                    <span className="font-semibold">{analytics.summary.teacherTotals?.users}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Time:</span>
                    <span className="font-semibold">
                      {analytics.summary.teacherTotals?.totalHours}h
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg Session:</span>
                    <span className="font-semibold">
                      {formatDuration(analytics.summary.teacherTotals?.averageMinutes || 0)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pl-6">
                <div className="flex items-center mb-4">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <h4 className="text-md font-medium text-gray-900">Students</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Active Users:</span>
                    <span className="font-semibold">{analytics.summary.studentTotals?.users}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Time:</span>
                    <span className="font-semibold">
                      {analytics.summary.studentTotals?.totalHours}h
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg Session:</span>
                    <span className="font-semibold">
                      {formatDuration(analytics.summary.studentTotals?.averageMinutes || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Engagement Tab */}
      {activeTab === "engagement" && (
        <div className="space-y-6">
          {/* Login Frequency */}
          <div className="bg-white p-6 rounded-lg shadow border-2" style={{ borderColor }}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Login Frequency</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {analytics.engagement.loginFrequency.percentageActive.daily}%
                </div>
                <p className="text-sm text-gray-600 mt-1">Daily Active Users</p>
                <p className="text-xs text-gray-500">
                  {analytics.engagement.loginFrequency.daily} of{" "}
                  {analytics.engagement.loginFrequency.totalRegistered}
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {analytics.engagement.loginFrequency.percentageActive.weekly}%
                </div>
                <p className="text-sm text-gray-600 mt-1">Weekly Active Users</p>
                <p className="text-xs text-gray-500">
                  {analytics.engagement.loginFrequency.weekly} of{" "}
                  {analytics.engagement.loginFrequency.totalRegistered}
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {analytics.engagement.loginFrequency.percentageActive.monthly}%
                </div>
                <p className="text-sm text-gray-600 mt-1">Monthly Active Users</p>
                <p className="text-xs text-gray-500">
                  {analytics.engagement.loginFrequency.monthly} of{" "}
                  {analytics.engagement.loginFrequency.totalRegistered}
                </p>
              </div>
            </div>
          </div>

          {/* Activity Patterns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow border-2" style={{ borderColor }}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Peak Usage Hours</h3>
              <div className="space-y-2">
                {analytics.engagement.activityPatterns.peakHours.map((hour) => (
                  <div key={hour.hour} className="flex items-center">
                    <span className="text-sm text-gray-600 w-20">
                      {hour.hour}:00
                    </span>
                    <div className="flex-1 bg-gray-200 rounded-full h-6 ml-2">
                      <div
                        className="bg-blue-500 h-6 rounded-full flex items-center justify-end pr-2"
                        style={{
                          width: `${(hour.sessions / Math.max(...analytics.engagement.activityPatterns.peakHours.map(h => h.sessions))) * 100}%`,
                        }}
                      >
                        <span className="text-xs text-white font-semibold">
                          {hour.sessions}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border-2" style={{ borderColor }}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Peak Usage Days</h3>
              <div className="space-y-2">
                {analytics.engagement.activityPatterns.peakDays.map((day) => (
                  <div key={day.day} className="flex items-center">
                    <span className="text-sm text-gray-600 w-24">{day.day}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-6 ml-2">
                      <div
                        className="bg-green-500 h-6 rounded-full flex items-center justify-end pr-2"
                        style={{
                          width: `${(day.sessions / Math.max(...analytics.engagement.activityPatterns.peakDays.map(d => d.sessions))) * 100}%`,
                        }}
                      >
                        <span className="text-xs text-white font-semibold">
                          {day.sessions}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Assignment Completion */}
          <div className="bg-white p-6 rounded-lg shadow border-2" style={{ borderColor }}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Assignment Completion Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {analytics.engagement.assignmentCompletion.onTime}
                </div>
                <p className="text-sm text-gray-600 mt-1">On Time</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {analytics.engagement.assignmentCompletion.late}
                </div>
                <p className="text-sm text-gray-600 mt-1">Late</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {analytics.engagement.assignmentCompletion.missing}
                </div>
                <p className="text-sm text-gray-600 mt-1">Missing</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {analytics.engagement.assignmentCompletion.completionRate}%
                </div>
                <p className="text-sm text-gray-600 mt-1">Completion Rate</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Performance Tab */}
      {activeTab === "performance" && (
        <div className="space-y-6">
          {/* School Rankings */}
          <div className="bg-white p-6 rounded-lg shadow border-2" style={{ borderColor }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">School Performance Rankings</h3>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1 text-sm"
              >
                <option value="engagement">Sort by Engagement</option>
                <option value="completion">Sort by Completion</option>
                <option value="time">Sort by Time Spent</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Rank</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">School</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-900">
                      Engagement
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-900">
                      Completion
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-900">
                      Avg Time
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-900">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.performance.schoolRankings.map((school) => (
                    <tr key={school.schoolId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          <span className="font-semibold text-gray-900">#{school.rank}</span>
                          {school.rank <= 3 && (
                            <Award
                              className={`w-4 h-4 ml-2 ${
                                school.rank === 1
                                  ? "text-yellow-500"
                                  : school.rank === 2
                                  ? "text-gray-400"
                                  : "text-orange-600"
                              }`}
                            />
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-medium text-gray-900">{school.schoolName}</div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {school.engagementScore}%
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {school.completionRate}%
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-sm text-gray-900">{school.avgTimeSpent}m</span>
                      </td>
                      <td className="py-4 px-4 text-center">{getTrendIcon(school.trend)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Teacher Effectiveness */}
          <div className="bg-white p-6 rounded-lg shadow border-2" style={{ borderColor }}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Teachers</h3>
            <div className="space-y-4">
              {analytics.performance.teacherEffectiveness.slice(0, 5).map((teacher) => (
                <div key={teacher.teacherId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{teacher.teacherName}</p>
                    <p className="text-sm text-gray-600">
                      {teacher.studentCount} students
                    </p>
                  </div>
                  <div className="flex items-center space-x-6">
                    <div className="text-center">
                      <p className="text-lg font-semibold text-blue-600">
                        {teacher.avgStudentEngagement}%
                      </p>
                      <p className="text-xs text-gray-500">Engagement</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-green-600">
                        {teacher.assignmentCompletionRate}%
                      </p>
                      <p className="text-xs text-gray-500">Completion</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-purple-600">
                        {teacher.avgResponseTime}h
                      </p>
                      <p className="text-xs text-gray-500">Response Time</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Student Progress */}
          <div className="bg-white p-6 rounded-lg shadow border-2" style={{ borderColor }}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Student Progress Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-600">
                  {analytics.performance.studentProgress.improving}
                </div>
                <p className="text-sm text-gray-600 mt-1">Improving</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Activity className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-600">
                  {analytics.performance.studentProgress.stable}
                </div>
                <p className="text-sm text-gray-600 mt-1">Stable</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <TrendingDown className="w-8 h-8 text-red-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-red-600">
                  {analytics.performance.studentProgress.declining}
                </div>
                <p className="text-sm text-gray-600 mt-1">Declining</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <Target className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-600">
                  +{analytics.performance.studentProgress.averageGrowthRate}%
                </div>
                <p className="text-sm text-gray-600 mt-1">Avg Growth</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparative Tab */}
      {activeTab === "comparative" && (
        <div className="space-y-6">
          {/* Growth Trends */}
          <div className="bg-white p-6 rounded-lg shadow border-2" style={{ borderColor }}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Growth Trends</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Week over Week</p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Users:</span>
                    <span className="text-sm font-semibold text-green-600">
                      +{analytics.comparative.growthTrends.weekOverWeek.users}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Sessions:</span>
                    <span className="text-sm font-semibold text-green-600">
                      +{analytics.comparative.growthTrends.weekOverWeek.sessions}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Engagement:</span>
                    <span className="text-sm font-semibold text-green-600">
                      +{analytics.comparative.growthTrends.weekOverWeek.engagement}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Month over Month</p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Users:</span>
                    <span className="text-sm font-semibold text-green-600">
                      +{analytics.comparative.growthTrends.monthOverMonth.users}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Sessions:</span>
                    <span className="text-sm font-semibold text-green-600">
                      +{analytics.comparative.growthTrends.monthOverMonth.sessions}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Engagement:</span>
                    <span className="text-sm font-semibold text-green-600">
                      +{analytics.comparative.growthTrends.monthOverMonth.engagement}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Year over Year</p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Users:</span>
                    <span className="text-sm font-semibold text-green-600">
                      +{analytics.comparative.growthTrends.yearOverYear?.users}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Sessions:</span>
                    <span className="text-sm font-semibold text-green-600">
                      +{analytics.comparative.growthTrends.yearOverYear?.sessions}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Engagement:</span>
                    <span className="text-sm font-semibold text-green-600">
                      +{analytics.comparative.growthTrends.yearOverYear?.engagement}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Grade Level Analytics */}
          <div className="bg-white p-6 rounded-lg shadow border-2" style={{ borderColor }}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Grade Level Performance</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Grade</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-900">Students</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-900">
                      Engagement
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-900">
                      Avg Time
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-900">
                      Completion
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.comparative.gradeAnalytics.map((grade) => (
                    <tr key={grade.grade} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div className="font-medium text-gray-900">{grade.grade}</div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-sm text-gray-900">{grade.studentCount}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {grade.avgEngagement}%
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-sm text-gray-900">{grade.avgTimeSpent}m</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {grade.completionRate}%
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Resources Tab */}
      {activeTab === "resources" && (
        <div className="space-y-6">
          {/* Feature Usage */}
          <div className="bg-white p-6 rounded-lg shadow border-2" style={{ borderColor }}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Usage Statistics</h3>
            <div className="space-y-3">
              {analytics.resources.featureUsage.map((feature) => (
                <div key={feature.feature} className="flex items-center">
                  <span className="text-sm text-gray-600 w-32">{feature.feature}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-8 ml-4">
                    <div
                      className="bg-blue-500 h-8 rounded-full flex items-center justify-between px-3"
                      style={{ width: `${feature.percentageOfTotal}%` }}
                    >
                      <span className="text-xs text-white font-semibold">
                        {feature.usageCount.toLocaleString()}
                      </span>
                      <span className="text-xs text-white">{feature.percentageOfTotal}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Device & Browser Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow border-2" style={{ borderColor }}>
              <h3 className="text-md font-semibold text-gray-900 mb-4">Devices</h3>
              <div className="space-y-2">
                {Object.entries(analytics.resources.deviceBreakdown.devices).map(
                  ([device, count]) => (
                    <div key={device} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{device}</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {count.toLocaleString()}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow border-2" style={{ borderColor }}>
              <h3 className="text-md font-semibold text-gray-900 mb-4">Browsers</h3>
              <div className="space-y-2">
                {Object.entries(analytics.resources.deviceBreakdown.browsers).map(
                  ([browser, count]) => (
                    <div key={browser} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{browser}</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {count.toLocaleString()}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow border-2" style={{ borderColor }}>
              <h3 className="text-md font-semibold text-gray-900 mb-4">Operating Systems</h3>
              <div className="space-y-2">
                {Object.entries(analytics.resources.deviceBreakdown.operatingSystems).map(
                  ([os, count]) => (
                    <div key={os} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{os}</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {count.toLocaleString()}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Bandwidth Usage */}
          {analytics.resources.bandwidthUsage && (
            <div className="bg-white p-6 rounded-lg shadow border-2" style={{ borderColor }}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Bandwidth Usage (GB)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {analytics.resources.bandwidthUsage.total.toFixed(1)}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Total</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {analytics.resources.bandwidthUsage.average.toFixed(1)}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Daily Average</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {analytics.resources.bandwidthUsage.peak.toFixed(1)}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Peak</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Warnings Tab */}
      {activeTab === "warnings" && (
        <div className="space-y-6">
          {/* Inactive Users Alert */}
          <div className="bg-white p-6 rounded-lg shadow border-2 border-l-4 border-l-red-500" style={{ borderColor }}>
            <div className="flex items-center mb-4">
              <UserX className="w-6 h-6 text-red-500 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Inactive Users</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Inactive Students</h4>
                <div className="space-y-2">
                  {analytics.warnings.inactiveUsers.students.slice(0, 5).map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-3 bg-red-50 rounded"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{student.name}</p>
                        <p className="text-sm text-gray-600">{student.school}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-red-600">
                          {student.daysInactive} days
                        </p>
                        <p className="text-xs text-gray-500">
                          Last: {new Date(student.lastLogin).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Inactive Teachers</h4>
                <div className="space-y-2">
                  {analytics.warnings.inactiveUsers.teachers.slice(0, 5).map((teacher) => (
                    <div
                      key={teacher.id}
                      className="flex items-center justify-between p-3 bg-red-50 rounded"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{teacher.name}</p>
                        <p className="text-sm text-gray-600">{teacher.school}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-red-600">
                          {teacher.daysInactive} days
                        </p>
                        <p className="text-xs text-gray-500">
                          Last: {new Date(teacher.lastLogin).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Low Engagement Schools */}
          <div className="bg-white p-6 rounded-lg shadow border-2 border-l-4 border-l-yellow-500" style={{ borderColor }}>
            <div className="flex items-center mb-4">
              <School className="w-6 h-6 text-yellow-500 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Low Engagement Schools</h3>
            </div>
            <div className="space-y-3">
              {analytics.warnings.lowEngagementSchools.map((school) => (
                <div
                  key={school.schoolId}
                  className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{school.schoolName}</p>
                    <p className="text-sm text-gray-600">
                      Engagement Rate: {school.engagementRate}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-yellow-600">
                      {school.belowAverageBy}% below average
                    </p>
                    <button className="text-xs text-blue-600 hover:underline mt-1">
                      View Details →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assignment Backlog */}
          <div className="bg-white p-6 rounded-lg shadow border-2 border-l-4 border-l-orange-500" style={{ borderColor }}>
            <div className="flex items-center mb-4">
              <AlertCircle className="w-6 h-6 text-orange-500 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Assignment Backlog</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-orange-50 rounded">
                <div className="text-2xl font-bold text-orange-600">
                  {analytics.warnings.assignmentBacklog.ungraded}
                </div>
                <p className="text-sm text-gray-600">Ungraded</p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded">
                <div className="text-2xl font-bold text-orange-600">
                  {analytics.warnings.assignmentBacklog.overdue}
                </div>
                <p className="text-sm text-gray-600">Overdue</p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded">
                <div className="text-2xl font-bold text-orange-600">
                  {analytics.warnings.assignmentBacklog.avgDaysOverdue}
                </div>
                <p className="text-sm text-gray-600">Avg Days Overdue</p>
              </div>
            </div>
            <div className="space-y-2">
              {analytics.warnings.assignmentBacklog.byTeacher.slice(0, 3).map((teacher) => (
                <div
                  key={teacher.teacherId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded"
                >
                  <span className="text-sm font-medium text-gray-900">{teacher.teacherName}</span>
                  <div className="flex space-x-4">
                    <span className="text-sm text-gray-600">
                      {teacher.ungradedCount} ungraded
                    </span>
                    <span className="text-sm text-red-600">{teacher.overdueCount} overdue</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}