// components/dashboard/schools/SchoolDetails.tsx
"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Building2,
  Users,
  GraduationCap,
  FileText,
  MapPin,
  Calendar,
  Mail,
  Plus,
  MoreVertical,
  Settings,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { UserRole } from "@/lib/supabase";

interface User {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: UserRole;
  created_at: string;
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  due_date: string | null;
  status: string;
  teacher?: {
    first_name: string | null;
    last_name: string | null;
  };
}

interface School {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
  settings: Record<string, any>;
  districts?: {
    id: string;
    name: string;
  };
}

interface UserStats {
  total: number;
  school_admin: number;
  teacher: number;
  student: number;
}

interface SchoolDetailsProps {
  school: School;
  users: User[];
  assignments: Assignment[];
  userStats: UserStats;
  districtName: string;
}

const getRoleDisplayName = (role: UserRole): string => {
  switch (role) {
    case "district_admin":
      return "District Admin";
    case "school_admin":
      return "School Admin";
    case "teacher":
      return "Teacher";
    case "student":
      return "Student";
    default:
      return role;
  }
};

const getRoleBadgeColor = (role: UserRole): string => {
  switch (role) {
    case "district_admin":
      return "bg-purple-100 text-purple-800";
    case "school_admin":
      return "bg-blue-100 text-blue-800";
    case "teacher":
      return "bg-green-100 text-green-800";
    case "student":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export default function SchoolDetails({
  school,
  users,
  assignments,
  userStats,
  districtName,
}: SchoolDetailsProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "users" | "teachers" | "assignments"
  >("overview");

  const tabs = [
    { id: "overview" as const, name: "Overview", icon: Building2 },
    {
      id: "users" as const,
      name: "Users",
      icon: Users,
      count: userStats.total,
    },
    {
      id: "teachers" as const,
      name: "Teachers",
      icon: GraduationCap,
      count: userStats.teacher,
    },
    {
      id: "assignments" as const,
      name: "Assignments",
      icon: FileText,
      count: assignments.length,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/dashboard/schools"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Schools
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {school.name}
              </h1>
              <p className="text-gray-600">{districtName}</p>
              {school.address && (
                <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                  <MapPin className="w-4 h-4" />
                  {school.address}
                </div>
              )}
              <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                <Calendar className="w-4 h-4" />
                Created {new Date(school.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/schools/${school.id}/users`}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Manage Users
          </Link>
          <button className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors">
            <Settings className="w-5 h-5" />
            Settings
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-gray-600" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Total Users</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {userStats.total}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">School Admins</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {userStats.school_admin}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Teachers</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {userStats.teacher}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Assignments</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {assignments.length}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.name}
                  {tab.count !== undefined && (
                    <span className="bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  School Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Name
                    </label>
                    <p className="mt-1 text-sm text-gray-900">{school.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      District
                    </label>
                    <p className="mt-1 text-sm text-gray-900">{districtName}</p>
                  </div>
                  {school.address && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Address
                      </label>
                      <p className="mt-1 text-sm text-gray-900">
                        {school.address}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Created
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      {new Date(school.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {school.settings?.description && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <p className="mt-1 text-sm text-gray-900">
                        {school.settings.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Quick Actions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Link
                    href={`/dashboard/schools/${school.id}/users`}
                    className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        Manage Users
                      </h4>
                      <p className="text-sm text-gray-600">
                        View and manage school users
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
                      <h4 className="font-medium text-gray-900">Add Users</h4>
                      <p className="text-sm text-gray-600">
                        Create new school users
                      </p>
                    </div>
                  </Link>

                  <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        View Assignments
                      </h4>
                      <p className="text-sm text-gray-600">
                        See all school assignments
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "users" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  School Users
                </h3>
                <Link
                  href="/dashboard/users/invite"
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add User
                </Link>
              </div>

              {users.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    No users assigned
                  </h4>
                  <p className="text-gray-600 mb-4">
                    This school doesn&apos;t have any users yet.
                  </p>
                  <Link
                    href="/dashboard/users/invite"
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add First User
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">
                            {user.first_name?.[0] ||
                              user.email[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </h4>
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                            user.role
                          )}`}
                        >
                          {getRoleDisplayName(user.role)}
                        </span>
                        <button className="text-gray-400 hover:text-gray-600">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "assignments" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Recent Assignments
                </h3>
                <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                  <Plus className="w-4 h-4" />
                  Create Assignment
                </button>
              </div>

              {assignments.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    No assignments yet
                  </h4>
                  <p className="text-gray-600 mb-4">
                    Teachers haven&apos;t created any assignments for this
                    school.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {assignment.title}
                        </h4>
                        <p className="text-sm text-gray-600">
                          Created by {assignment.teacher?.first_name}{" "}
                          {assignment.teacher?.last_name}
                        </p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-gray-500">
                            Created{" "}
                            {new Date(
                              assignment.created_at
                            ).toLocaleDateString()}
                          </span>
                          {assignment.due_date && (
                            <span className="text-xs text-gray-500">
                              Due{" "}
                              {new Date(
                                assignment.due_date
                              ).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <button className="text-gray-400 hover:text-gray-600">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
