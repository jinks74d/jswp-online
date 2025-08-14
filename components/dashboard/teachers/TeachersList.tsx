// components/dashboard/teachers/TeachersList.tsx
"use client";

import { useState } from "react";
import {
  GraduationCap,
  Plus,
  Search,
  Filter,
  Calendar,
  School,
  Mail,
  MoreVertical,
  Building2,
  Users,
  BookOpen,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { UserRole } from "@/lib/supabase";

interface Teacher {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  created_at: string;
  schools?: { id: string; name: string } | null;
}

interface School {
  id: string;
  name: string;
}

interface TeachersListProps {
  teachers: Teacher[];
  schools: School[];
  currentUserRole: UserRole;
  currentUserSchool?: { id: string; name: string } | null;
  districtName: string;
  districtBranding?: {
    primary_color?: string | null;
    secondary_color?: string | null;
    logo_url?: string | null;
  };
  schoolBranding?: {
    primary_color?: string | null;
    secondary_color?: string | null;
    logo_url?: string | null;
  };
}

export default function TeachersList({
  teachers,
  schools,
  currentUserRole,
  currentUserSchool,
  districtName,
  districtBranding,
  schoolBranding,
}: TeachersListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");

  // School branding with district fallback
  const schoolSecondaryColor = 
    schoolBranding?.secondary_color || 
    districtBranding?.secondary_color || 
    "#64748B";

  const filteredTeachers = teachers.filter((teacher) => {
    const matchesSearch =
      (teacher.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ??
        false) ||
      (teacher.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ??
        false) ||
      teacher.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSchool =
      schoolFilter === "all" || teacher.schools?.id === schoolFilter;

    return matchesSearch && matchesSchool;
  });

  const teacherStats = {
    total: teachers.length,
    withSchools: teachers.filter((t) => t.schools).length,
    withoutSchools: teachers.filter((t) => !t.schools).length,
    newThisMonth: teachers.filter(
      (t) =>
        new Date(t.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length,
  };

  const getPageTitle = () => {
    if (currentUserRole === "district_admin") {
      return "All Teachers";
    } else if (currentUserRole === "school_admin") {
      return `${currentUserSchool?.name} Teachers`;
    } else {
      return "Teaching Staff";
    }
  };

  const getPageDescription = () => {
    if (currentUserRole === "district_admin") {
      return `Manage all teachers across ${districtName}`;
    } else if (currentUserRole === "school_admin") {
      return `Manage teaching staff at ${currentUserSchool?.name}`;
    } else {
      return `View teaching colleagues at ${currentUserSchool?.name}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{getPageTitle()}</h1>
          <p className="text-gray-600 mt-1">{getPageDescription()}</p>
        </div>
        {["district_admin", "school_admin"].includes(currentUserRole) && (
          <Link
            href="/dashboard/users/invite"
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Teacher
          </Link>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4" style={{ border: `2px solid ${schoolSecondaryColor}` }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Total Teachers
              </p>
              <p className="text-xl font-bold text-gray-900">
                {teacherStats.total}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4" style={{ border: `2px solid ${schoolSecondaryColor}` }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Assigned to Schools
              </p>
              <p className="text-xl font-bold text-gray-900">
                {teacherStats.withSchools}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4" style={{ border: `2px solid ${schoolSecondaryColor}` }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Unassigned</p>
              <p className="text-xl font-bold text-gray-900">
                {teacherStats.withoutSchools}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4" style={{ border: `2px solid ${schoolSecondaryColor}` }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                New This Month
              </p>
              <p className="text-xl font-bold text-gray-900">
                {teacherStats.newThisMonth}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4" style={{ border: `2px solid ${schoolSecondaryColor}` }}>
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search teachers by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* School Filter - Only for District Admins */}
          {currentUserRole === "district_admin" && schools.length > 0 && (
            <div className="relative">
              <School className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <select
                value={schoolFilter}
                onChange={(e) => setSchoolFilter(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="all">All Schools</option>
                <option value="">Unassigned</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="text-sm text-gray-600 flex items-center">
            {filteredTeachers.length} of {teachers.length} teachers
          </div>
        </div>
      </div>

      {/* Teachers List */}
      {filteredTeachers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center" style={{ border: `2px solid ${schoolSecondaryColor}` }}>
          <GraduationCap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm || schoolFilter !== "all"
              ? "No teachers found"
              : "No teachers yet"}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || schoolFilter !== "all"
              ? "Try adjusting your search terms or filters"
              : currentUserRole === "teacher"
              ? "No other teachers are visible to you yet"
              : "Start by adding teachers to your district"}
          </p>
          {!searchTerm &&
            schoolFilter === "all" &&
            ["district_admin", "school_admin"].includes(currentUserRole) && (
              <Link
                href="/dashboard/users/invite"
                className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add First Teacher
              </Link>
            )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden" style={{ border: `2px solid ${schoolSecondaryColor}` }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Teacher
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    School Assignment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  {["district_admin", "school_admin"].includes(
                    currentUserRole
                  ) && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                          <GraduationCap className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {teacher.first_name} {teacher.last_name}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {teacher.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {teacher.schools?.name ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-500" />
                          <span className="text-sm text-gray-900">
                            {teacher.schools.name}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                        {new Date(teacher.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    </td>
                    {["district_admin", "school_admin"].includes(
                      currentUserRole
                    ) && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/users/${teacher.id}/edit`}
                            className="text-blue-600 hover:text-blue-700"
                            title="Edit teacher"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </Link>
                          <button className="text-gray-400 hover:text-gray-600">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Stats Summary */}
      {teachers.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6" style={{ border: `2px solid ${schoolSecondaryColor}` }}>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Teaching Staff Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <GraduationCap className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {teacherStats.total}
              </div>
              <div className="text-sm text-gray-600">Total Teachers</div>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {(
                  (teacherStats.withSchools / teacherStats.total) *
                  100
                ).toFixed(0)}
                %
              </div>
              <div className="text-sm text-gray-600">Assigned to Schools</div>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {teacherStats.newThisMonth}
              </div>
              <div className="text-sm text-gray-600">New This Month</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
