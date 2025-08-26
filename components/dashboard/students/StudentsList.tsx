// components/dashboard/students/StudentsList.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Search,
  Filter,
  Calendar,
  School,
  Mail,
  MoreVertical,
  Building2,
  GraduationCap,
  BookOpen,
  FileText,
  ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import { UserRole } from "@/lib/supabase";
import BulkStudentUpload from "./BulkStudentUpload";

interface Student {
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

interface StudentsListProps {
  students: Student[];
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

export default function StudentsList({
  students,
  schools,
  currentUserRole,
  currentUserSchool,
  districtName,
  districtBranding,
  schoolBranding,
}: StudentsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [addingStudent, setAddingStudent] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const supabase = createClient();

  // School branding with district fallback
  const schoolSecondaryColor = 
    schoolBranding?.secondary_color || 
    districtBranding?.secondary_color || 
    "#64748B";

  // Fetch available students for the dropdown
  useEffect(() => {
    if (currentUserRole === "teacher" && currentUserSchool?.id) {
      fetchAvailableStudents();
    }
  }, [currentUserRole, currentUserSchool?.id]);

  const fetchAvailableStudents = async () => {
    if (!currentUserSchool?.id) return;

    try {
      // Get all students in the school who are not already in the current list
      const currentStudentIds = students.map(s => s.id);
      
      let query = supabase
        .from("user_profiles")
        .select("id, first_name, last_name, email, created_at")
        .eq("role", "student")
        .eq("school_id", currentUserSchool.id);

      if (currentStudentIds.length > 0) {
        query = query.not("id", "in", `(${currentStudentIds.join(",")})`);
      }

      const { data: availableStudentsData, error } = await query;

      if (error) {
        console.error("Error fetching available students:", error);
      } else {
        setAvailableStudents(availableStudentsData || []);
      }
    } catch (error) {
      console.error("Error fetching available students:", error);
    }
  };

  const handleAddStudent = async () => {
    if (!selectedStudentId || addingStudent) return;
    
    setAddingStudent(true);
    // TODO: Implement student assignment logic
    console.log("Adding student:", selectedStudentId);
    
    // Reset selection and close dropdown
    setSelectedStudentId("");
    setShowAddDropdown(false);
    setAddingStudent(false);
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      (student.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ??
        false) ||
      (student.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ??
        false) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSchool =
      schoolFilter === "all" || student.schools?.id === schoolFilter;

    return matchesSearch && matchesSchool;
  });

  const studentStats = {
    total: students.length,
    withSchools: students.filter((s) => s.schools).length,
    withoutSchools: students.filter((s) => !s.schools).length,
    newThisMonth: students.filter(
      (s) =>
        new Date(s.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length,
  };

  const getPageTitle = () => {
    if (currentUserRole === "district_admin") {
      return "All Students";
    } else if (currentUserRole === "school_admin") {
      return `${currentUserSchool?.name} Students`;
    } else {
      return "My Students";
    }
  };

  const getPageDescription = () => {
    if (currentUserRole === "district_admin") {
      return `Manage all students across ${districtName}`;
    } else if (currentUserRole === "school_admin") {
      return `Manage students at ${currentUserSchool?.name}`;
    } else {
      return `View and manage your students at ${currentUserSchool?.name}`;
    }
  };

  const canAddStudents = ["district_admin", "school_admin", "teacher"].includes(
    currentUserRole
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{getPageTitle()}</h1>
          <p className="text-gray-600 mt-1">{getPageDescription()}</p>
        </div>
        {canAddStudents && (
          <>
            {currentUserRole === "teacher" ? (
              <div className="relative">
                <div className="flex items-center gap-2">
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    <option value="">Select a student...</option>
                    {availableStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.first_name} {student.last_name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddStudent}
                    disabled={!selectedStudentId || addingStudent}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {addingStudent ? "Adding..." : "Add"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard/users/invite"
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Add Student
                </Link>
                {["school_admin", "district_admin"].includes(currentUserRole) && currentUserSchool?.id && (
                  <BulkStudentUpload
                    schoolId={currentUserSchool.id}
                    schoolName={currentUserSchool.name}
                    onUploadComplete={() => {
                      setRefreshTrigger(prev => prev + 1);
                      // Refresh the page to show new students
                      window.location.reload();
                    }}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4" style={{ border: `2px solid ${schoolSecondaryColor}` }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Total Students
              </p>
              <p className="text-xl font-bold text-gray-900">
                {studentStats.total}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4" style={{ border: `2px solid ${schoolSecondaryColor}` }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Enrolled</p>
              <p className="text-xl font-bold text-gray-900">
                {studentStats.withSchools}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4" style={{ border: `2px solid ${schoolSecondaryColor}` }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Not Enrolled</p>
              <p className="text-xl font-bold text-gray-900">
                {studentStats.withoutSchools}
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
                {studentStats.newThisMonth}
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
              placeholder="Search students by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* School Filter - Only for District Admins */}
          {currentUserRole === "district_admin" && schools.length > 0 && (
            <div className="relative">
              <School className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <select
                value={schoolFilter}
                onChange={(e) => setSchoolFilter(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Schools</option>
                <option value="">Not Enrolled</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="text-sm text-gray-600 flex items-center">
            {filteredStudents.length} of {students.length} students
          </div>
        </div>
      </div>

      {/* Students List */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center" style={{ border: `2px solid ${schoolSecondaryColor}` }}>
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm || schoolFilter !== "all"
              ? "No students found"
              : "No students yet"}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || schoolFilter !== "all"
              ? "Try adjusting your search terms or filters"
              : currentUserRole === "teacher"
              ? "Start by adding students to your classes"
              : "Start by enrolling students in your school"}
          </p>
          {!searchTerm && schoolFilter === "all" && canAddStudents && (
            <Link
              href="/dashboard/users/invite"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add First Student
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
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    School
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Enrolled
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
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Link
                          href={`/dashboard/students/${student.id}`}
                          className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4 hover:bg-blue-200 transition-colors"
                        >
                          <Users className="w-6 h-6 text-blue-600" />
                        </Link>
                        <div>
                          <Link
                            href={`/dashboard/students/${student.id}`}
                            className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
                          >
                            {student.first_name} {student.last_name}
                          </Link>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {student.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {student.schools?.name ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-gray-900">
                            {student.schools.name}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          Not Enrolled
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                        {new Date(student.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Active
                      </span>
                    </td>
                    {["district_admin", "school_admin"].includes(
                      currentUserRole
                    ) && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/users/${student.id}/edit`}
                            className="text-blue-600 hover:text-blue-700"
                            title="Edit student"
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
      {students.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6" style={{ border: `2px solid ${schoolSecondaryColor}` }}>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Student Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {studentStats.total}
              </div>
              <div className="text-sm text-gray-600">Total Students</div>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Building2 className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {studentStats.total > 0
                  ? (
                      (studentStats.withSchools / studentStats.total) *
                      100
                    ).toFixed(0)
                  : 0}
                %
              </div>
              <div className="text-sm text-gray-600">Enrollment Rate</div>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {studentStats.newThisMonth}
              </div>
              <div className="text-sm text-gray-600">New This Month</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
