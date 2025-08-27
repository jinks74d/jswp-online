// components/dashboard/SchoolAdminDashboard.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import {
  Users,
  GraduationCap,
  FileText,
  Calendar,
  Plus,
  TrendingUp,
  Building2,
  UserPlus,
  BookOpen,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { UserProfile } from "@/lib/supabase";

interface SchoolStats {
  totalTeachers: number;
  totalStudents: number;
  totalClasses: number;
  totalAssignments: number;
  recentUsers: any[];
  recentAssignments: any[];
}

interface SchoolAdminDashboardProps {
  profile: UserProfile & {
    districts?: {
      id: string;
      name: string;
      domain: string | null;
      logo_url: string | null;
      primary_color: string | null;
      secondary_color: string | null;
    };
    schools?: {
      id: string;
      name: string;
      primary_color?: string | null;
      secondary_color?: string | null;
      logo_url?: string | null;
    };
  };
}

export default function SchoolAdminDashboard({
  profile,
}: SchoolAdminDashboardProps) {
  const [stats, setStats] = useState<SchoolStats>({
    totalTeachers: 0,
    totalStudents: 0,
    totalClasses: 0,
    totalAssignments: 0,
    recentUsers: [],
    recentAssignments: [],
  });
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchSchoolStats = useCallback(async () => {
    try {
      if (!profile.school_id) return;

      // Get teachers count for this school
      const { count: teachersCount } = await supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .eq("school_id", profile.school_id)
        .eq("role", "teacher");

      // Get students count for this school
      const { count: studentsCount } = await supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .eq("school_id", profile.school_id)
        .eq("role", "student");

      // Get classes count for this school (placeholder - classes table doesn't exist yet)
      const classesCount = 0;

      // Get assignments count for this school (placeholder - assignments table doesn't exist yet)
      const assignmentsCount = 0;

      // Get recent users (teachers and students)
      const { data: recentUsers } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("school_id", profile.school_id)
        .in("role", ["teacher", "student"])
        .order("created_at", { ascending: false })
        .limit(5);

      setStats({
        totalTeachers: teachersCount || 0,
        totalStudents: studentsCount || 0,
        totalClasses: classesCount || 0,
        totalAssignments: assignmentsCount || 0,
        recentUsers: recentUsers || [],
        recentAssignments: [],
      });
    } catch (error) {
      console.error("Error fetching school stats:", error);
    } finally {
      setLoading(false);
    }
  }, [profile.school_id]);

  useEffect(() => {
    fetchSchoolStats();
  }, [fetchSchoolStats]);

  const statCards = [
    {
      name: "Teachers",
      value: stats.totalTeachers,
      icon: GraduationCap,
      color: "bg-green-500",
      href: `/dashboard/schools/${profile.school_id}/users?role=teacher`,
      change: "+2 this month",
    },
    {
      name: "Students",
      value: stats.totalStudents,
      icon: Users,
      color: "bg-blue-500",
      href: `/dashboard/schools/${profile.school_id}/users?role=student`,
      change: "+12 this semester",
    },
    {
      name: "Classes",
      value: stats.totalClasses,
      icon: BookOpen,
      color: "bg-purple-500",
      href: "/dashboard/classes",
      change: "+1 this semester",
    },
    {
      name: "Assignments",
      value: stats.totalAssignments,
      icon: FileText,
      color: "bg-orange-500",
      href: "/dashboard/assignments",
      change: "+8 this week",
    },
  ];

  // Get school secondary color for borders, fallback to district, then default
  const schoolSecondaryColor =
    profile.schools?.secondary_color ||
    profile.districts?.secondary_color ||
    "#64748B";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">School Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Welcome back, {profile.first_name}! Managing {profile.schools?.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/users/invite"
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Add Teacher
          </Link>
          <Link
            href="/dashboard/classes/create"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <BookOpen className="w-5 h-5" />
            Create Class
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.name}
              href={stat.href}
              className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
              style={{ border: `2px solid ${schoolSecondaryColor}` }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.color} rounded-lg p-3`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs">{stat.change}</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {stat.value}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Users */}
        <div
          className="bg-white rounded-lg shadow-sm"
          style={{ border: `2px solid ${schoolSecondaryColor}` }}
        >
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Users
              </h2>
              <Link
                href={`/dashboard/schools/${profile.school_id}/users`}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Manage all
              </Link>
            </div>
          </div>
          <div className="p-6">
            {stats.recentUsers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No users yet
                </h3>
                <p className="text-gray-600 mb-4">
                  Start by adding teachers to your school
                </p>
                <Link
                  href="/dashboard/users/invite"
                  className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Teacher
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.recentUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          user.role === "teacher"
                            ? "bg-green-100"
                            : "bg-blue-100"
                        }`}
                      >
                        <span className="text-sm font-medium">
                          {user.first_name?.[0] || user.email[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </h3>
                        <p className="text-sm text-gray-600 capitalize">
                          {user.role}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* School Performance */}
        <div
          className="bg-white rounded-lg shadow-sm"
          style={{ border: `2px solid ${schoolSecondaryColor}` }}
        >
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              School Performance
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">
                    Teacher to Student Ratio
                  </h3>
                  <p className="text-sm text-gray-600">
                    Current staffing levels
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    1:
                    {stats.totalTeachers > 0
                      ? Math.round(stats.totalStudents / stats.totalTeachers)
                      : 0}
                  </div>
                  <p className="text-xs text-gray-500">teacher:students</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Active Users</h3>
                  <p className="text-sm text-gray-600">
                    Total school community
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">
                    {stats.totalTeachers + stats.totalStudents}
                  </div>
                  <p className="text-xs text-gray-500">total users</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">
                    Growth This Month
                  </h3>
                  <p className="text-sm text-gray-600">New additions</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-orange-600">+14</div>
                  <p className="text-xs text-gray-500">new users</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div
        className="bg-white rounded-lg shadow-sm p-6"
        style={{ border: `2px solid ${schoolSecondaryColor}` }}
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Link
            href={`/dashboard/schools/${profile.school_id}/users`}
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Manage Users</h3>
              <p className="text-sm text-gray-600">
                View teachers and students
              </p>
            </div>
          </Link>

          <Link
            href="/dashboard/users/invite"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Add Teachers</h3>
              <p className="text-sm text-gray-600">Invite new teaching staff</p>
            </div>
          </Link>

          <Link
            href="/dashboard/classes"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">View Classes</h3>
              <p className="text-sm text-gray-600">Monitor school classes</p>
            </div>
          </Link>

          <Link
            href="/dashboard/assignments"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">View Assignments</h3>
              <p className="text-sm text-gray-600">
                Monitor school assignments
              </p>
            </div>
          </Link>

          <Link
            href="/dashboard/analytics"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">View Analytics</h3>
              <p className="text-sm text-gray-600">Track school performance</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Analytics Summary */}
      <div
        className="bg-white rounded-lg shadow-sm p-6"
        style={{ border: `2px solid ${schoolSecondaryColor}` }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            School Analytics
          </h2>
          <Link
            href="/dashboard/analytics"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
          >
            <TrendingUp className="w-4 h-4" />
            View Full Analytics
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Clock className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-1">Daily Usage</h3>
            <p className="text-sm text-gray-600">Track engagement</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-1">Performance</h3>
            <p className="text-sm text-gray-600">Monitor progress</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Users className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-1">Active Users</h3>
            <p className="text-sm text-gray-600">Real-time activity</p>
          </div>
        </div>
      </div>

      {/* School Overview */}
      <div
        className="bg-white rounded-lg shadow-sm p-6"
        style={{ border: `2px solid ${schoolSecondaryColor}` }}
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          School Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-1">
              {profile.schools?.name}
            </h3>
            <p className="text-sm text-gray-600">Your School</p>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {stats.totalTeachers + stats.totalStudents}
            </div>
            <p className="text-sm font-medium text-gray-600">Total Users</p>
            <p className="text-xs text-gray-500">
              {stats.totalTeachers} teachers, {stats.totalStudents} students
            </p>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {stats.totalClasses}
            </div>
            <p className="text-sm font-medium text-gray-600">Active Classes</p>
            <p className="text-xs text-gray-500">
              {stats.totalAssignments} total assignments
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
