// app/super-admin/page.tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import { Building2, Users, GraduationCap, FileText, Plus } from "lucide-react";
import Link from "next/link";

interface Stats {
  totalDistricts: number;
  totalUsers: number;
  totalSchools: number;
  totalAssignments: number;
}

// Server-side data fetching with parallel queries
async function fetchDashboardData() {
  const cookieStore = await cookies();
  const supabase = await createServerSupabaseClient(cookieStore);

  try {
    // Execute all queries in parallel for optimal performance
    const [
      { count: districtCount },
      { count: userCount },
      { count: schoolCount },
      { count: assignmentCount },
      { data: recentDistricts },
    ] = await Promise.all([
      supabase.from("districts").select("*", { count: "exact", head: true }),
      supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true }),
      supabase.from("schools").select("*", { count: "exact", head: true }),
      supabase.from("assignments").select("*", { count: "exact", head: true }),
      supabase
        .from("districts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const stats: Stats = {
      totalDistricts: districtCount || 0,
      totalUsers: userCount || 0,
      totalSchools: schoolCount || 0,
      totalAssignments: assignmentCount || 0,
    };

    return { stats, recentDistricts: recentDistricts || [] };
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return {
      stats: {
        totalDistricts: 0,
        totalUsers: 0,
        totalSchools: 0,
        totalAssignments: 0,
      },
      recentDistricts: [],
    };
  }
}

export default async function SuperAdminDashboard() {
  const cookieStore = await cookies();
  const supabase = await createServerSupabaseClient(cookieStore);

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Get user profile and verify super admin role
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  // Fetch dashboard data
  const { stats, recentDistricts } = await fetchDashboardData();

  const statCards = [
    {
      name: "Total Districts",
      value: stats.totalDistricts,
      icon: Building2,
      color: "bg-blue-500",
      href: "/super-admin/districts",
    },
    {
      name: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "bg-green-500",
      href: "/super-admin/users",
    },
    {
      name: "Total Schools",
      value: stats.totalSchools,
      icon: GraduationCap,
      color: "bg-purple-500",
      href: "/super-admin/districts",
    },
    {
      name: "Total Assignments",
      value: stats.totalAssignments,
      icon: FileText,
      color: "bg-orange-500",
      href: "/super-admin/districts",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Super Admin Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Manage districts, users, and system settings
          </p>
        </div>
        <Link
          href="/super-admin/districts/create"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create District
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.name}
              href={stat.href}
              className="bg-white rounded-lg shadow-sm border-2 border-[#0B2559] p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {stat.name}
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {stat.value}
                  </p>
                </div>
                <div className={`${stat.color} rounded-lg p-3`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recent Districts */}
      <div className="bg-white rounded-lg shadow-sm border-2 border-[#0B2559]">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Districts
            </h2>
            <Link
              href="/super-admin/districts"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View all
            </Link>
          </div>
        </div>
        <div className="p-6">
          {recentDistricts.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No districts yet
              </h3>
              <p className="text-gray-600 mb-4">
                Get started by creating your first district
              </p>
              <Link
                href="/super-admin/districts/create"
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create First District
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {recentDistricts.map((district) => (
                <div
                  key={district.id}
                  className="flex items-center justify-between p-4 border-2 border-[#0B2559] rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {district.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {district.poc_email}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      Created{" "}
                      {new Date(district.created_at).toLocaleDateString()}
                    </p>
                    {district.domain && (
                      <p className="text-xs text-gray-500">{district.domain}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border-2 border-[#0B2559] p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/super-admin/districts/create"
            className="flex items-center gap-3 p-4 border-2 border-[#0B2559] rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Create District</h3>
              <p className="text-sm text-gray-600">
                Add a new district to the system
              </p>
            </div>
          </Link>

          <Link
            href="/super-admin/users"
            className="flex items-center gap-3 p-4 border-2 border-[#0B2559] rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Manage Users</h3>
              <p className="text-sm text-gray-600">View and manage all users</p>
            </div>
          </Link>

          <Link
            href="/super-admin/settings"
            className="flex items-center gap-3 p-4 border-2 border-[#0B2559] rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">System Settings</h3>
              <p className="text-sm text-gray-600">
                Configure system preferences
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
