// components/dashboard/DistrictAdminDashboard.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
  Building2,
  Users,
  GraduationCap,
  FileText,
  Plus,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { UserProfile } from "@/lib/supabase";

interface DistrictStats {
  totalSchools: number;
  totalTeachers: number;
  totalStudents: number;
  totalSchoolAdmins: number;
  recentUsers: any[];
  recentSchools: any[];
}

interface DistrictAdminDashboardProps {
  profile: UserProfile & {
    districts?: { id: string; name: string; domain: string | null; logo_url: string | null; primary_color: string | null; secondary_color: string | null };
  };
}

export default function DistrictAdminDashboard({
  profile,
}: DistrictAdminDashboardProps) {
  const [stats, setStats] = useState<DistrictStats>({
    totalSchools: 0,
    totalTeachers: 0,
    totalStudents: 0,
    totalSchoolAdmins: 0,
    recentUsers: [],
    recentSchools: [],
  });
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    if (profile.district_id) {
      fetchDistrictStats();
    } else {
      console.error('No district_id found for user profile');
      setLoading(false);
    }
  }, [profile.district_id]);

  const fetchDistrictStats = async () => {
    if (!profile.district_id) {
      console.error('Cannot fetch district stats: no district_id');
      setLoading(false);
      return;
    }
    
    try {
      // Get schools count
      const { count: schoolsCount } = await supabase
        .from("schools")
        .select("*", { count: "exact", head: true })
        .eq("district_id", profile.district_id);

      // Get teachers count
      const { count: teachersCount } = await supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .eq("district_id", profile.district_id)
        .eq("role", "teacher");

      // Get students count
      const { count: studentsCount } = await supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .eq("district_id", profile.district_id)
        .eq("role", "student");

      // Get school administrators count
      const { count: schoolAdminsCount } = await supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .eq("district_id", profile.district_id)
        .eq("role", "school_admin");

      // Get recent users
      const { data: recentUsers } = await supabase
        .from("user_profiles")
        .select("*, schools:school_id(name)")
        .eq("district_id", profile.district_id)
        .order("created_at", { ascending: false })
        .limit(5);

      // Get recent schools
      const { data: recentSchools } = await supabase
        .from("schools")
        .select("*")
        .eq("district_id", profile.district_id)
        .order("created_at", { ascending: false })
        .limit(5);

      setStats({
        totalSchools: schoolsCount || 0,
        totalTeachers: teachersCount || 0,
        totalStudents: studentsCount || 0,
        totalSchoolAdmins: schoolAdminsCount || 0,
        recentUsers: recentUsers || [],
        recentSchools: recentSchools || [],
      });
    } catch (error) {
      console.error("Error fetching district stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      name: "Schools",
      value: stats.totalSchools,
      icon: Building2,
      color: "bg-blue-500",
      href: "/dashboard/schools",
      change: "+12%",
    },
    {
      name: "Administrators",
      value: stats.totalSchoolAdmins,
      icon: Users,
      color: "bg-purple-500",
      href: "/dashboard/users?role=school_admin",
      change: "+8%",
    },
    {
      name: "Teachers",
      value: stats.totalTeachers,
      icon: GraduationCap,
      color: "bg-green-500",
      href: "/dashboard/users?role=teacher",
      change: "+5%",
    },
    {
      name: "Students",
      value: stats.totalStudents,
      icon: Users,
      color: "bg-orange-500",
      href: "/dashboard/users?role=student",
      change: "+23%",
    },
  ];

  // Get district secondary color for borders
  const districtSecondaryColor = profile.districts?.secondary_color || '#64748B';

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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          District Dashboard
        </h1>
        <p className="text-gray-600 mt-1">
          Welcome back, {profile.first_name}! Here&apos;s what&apos;s
          happening in {profile.districts?.name || "your district"}.
        </p>
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
              style={{ border: `2px solid ${districtSecondaryColor}` }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.color} rounded-lg p-3`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  {stat.change}
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
        {/* Recent Schools */}
        <div className="bg-white rounded-lg shadow-sm" style={{ border: `2px solid ${districtSecondaryColor}` }}>
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Schools
              </h2>
              <Link
                href="/dashboard/schools"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                View all
              </Link>
            </div>
          </div>
          <div className="p-6">
            {stats.recentSchools.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No schools yet
                </h3>
                <p className="text-gray-600 mb-4">
                  Get started by adding your first school
                </p>
                <Link
                  href="/dashboard/schools/create"
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add School
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.recentSchools.map((school) => (
                  <div
                    key={school.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {school.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {school.address || "No address provided"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        Added {new Date(school.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Users */}
        <div className="bg-white rounded-lg shadow-sm" style={{ border: `2px solid ${districtSecondaryColor}` }}>
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Users
              </h2>
              <Link
                href="/dashboard/users"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                View all
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
                  Start by inviting teachers and students
                </p>
                <Link
                  href="/dashboard/users/invite"
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Invite Users
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.recentUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {user.first_name?.[0] || user.email[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user.role === "teacher"
                                ? "bg-green-100 text-green-800"
                                : user.role === "student"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {user.role.replace("_", " ")}
                          </span>
                          {user.schools?.name && (
                            <span className="text-xs text-gray-500">
                              • {user.schools.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        Joined {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm p-6" style={{ border: `2px solid ${districtSecondaryColor}` }}>
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/dashboard/schools/create"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Add School</h3>
              <p className="text-sm text-gray-600">
                Create a new school in your district
              </p>
            </div>
          </Link>

          <Link
            href="/dashboard/users/invite"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Invite Users</h3>
              <p className="text-sm text-gray-600">
                Add teachers, admins, or students
              </p>
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
                Monitor district-wide assignments
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
