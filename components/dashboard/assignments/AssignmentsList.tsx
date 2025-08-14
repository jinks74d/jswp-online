// components/dashboard/assignments/AssignmentsList.tsx
"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  Users,
  FileText,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRole, createClient } from "@/lib/supabase";

interface Assignment {
  id: string;
  title: string;
  description: string;
  subject: string;
  class_name: string;
  teacher_name: string;
  due_date: string;
  created_at: string;
  status: string;
  submissions_count: number;
  total_students: number;
}

interface AssignmentsListProps {
  assignments: Assignment[];
  currentUserRole: UserRole;
  currentUserSchool?: { id: string; name: string } | null;
  districtName: string;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  schoolBranding?: {
    primary_color?: string | null;
    secondary_color?: string | null;
    logo_url?: string | null;
  };
}

export default function AssignmentsList({
  assignments,
  currentUserRole,
  currentUserSchool,
  districtName,
  logo_url,
  primary_color,
  secondary_color,
  schoolBranding,
}: AssignmentsListProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [teacherFilter, setTeacherFilter] = useState<string>("all");
  const [groupByTeacher, setGroupByTeacher] = useState(
    currentUserRole === "school_admin"
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // School branding with district fallback
  const schoolSecondaryColor = 
    schoolBranding?.secondary_color || 
    secondary_color || 
    "#0B2559";

  const handleDelete = async (
    assignmentId: string,
    assignmentTitle: string
  ) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${assignmentTitle}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(assignmentId);

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("assignments")
        .delete()
        .eq("id", assignmentId);

      if (error) {
        console.error("Error deleting assignment:", error);
        alert(`Error deleting assignment: ${error.message}`);
        setDeletingId(null);
        return;
      }

      // Refresh the page to show updated assignments list
      router.refresh();
    } catch (error: unknown) {
      console.error("Error deleting assignment:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      alert(`Error deleting assignment: ${errorMessage}`);
      setDeletingId(null);
    }
  };

  const filteredAssignments = assignments.filter((assignment) => {
    const matchesSearch =
      assignment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.class_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.teacher_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSubject =
      subjectFilter === "all" || assignment.subject === subjectFilter;

    const matchesStatus =
      statusFilter === "all" || assignment.status === statusFilter;

    const matchesTeacher =
      teacherFilter === "all" || assignment.teacher_name === teacherFilter;

    return matchesSearch && matchesSubject && matchesStatus && matchesTeacher;
  });

  // Get unique subjects and teachers for filtering
  const subjects = Array.from(
    new Set(assignments.map((a) => a.subject))
  ).sort();

  const teachers = Array.from(
    new Set(assignments.map((a) => a.teacher_name))
  ).sort();

  // Group assignments by teacher if enabled
  const groupedAssignments = groupByTeacher
    ? filteredAssignments.reduce((groups, assignment) => {
        const teacher = assignment.teacher_name;
        if (!groups[teacher]) {
          groups[teacher] = [];
        }
        groups[teacher].push(assignment);
        return groups;
      }, {} as Record<string, Assignment[]>)
    : { "All Assignments": filteredAssignments };

  const assignmentStats = {
    total: assignments.length,
    active: assignments.filter((a) => a.status === "active").length,
    completed: assignments.filter((a) => a.status === "completed").length,
    overdue: assignments.filter((a) => {
      const dueDate = new Date(a.due_date);
      const today = new Date();
      return dueDate < today && a.status === "active";
    }).length,
    totalSubmissions: assignments.reduce(
      (sum, a) => sum + a.submissions_count,
      0
    ),
    pendingGrading: assignments.reduce(
      (sum, a) => sum + (a.total_students - a.submissions_count),
      0
    ),
  };

  const getPageTitle = () => {
    if (currentUserRole === "district_admin") {
      return "All Assignments";
    } else if (currentUserRole === "school_admin") {
      return `${currentUserSchool?.name} Assignments`;
    } else {
      return "My Assignments";
    }
  };

  const getPageDescription = () => {
    if (currentUserRole === "district_admin") {
      return `Manage assignments across ${districtName}`;
    } else if (currentUserRole === "school_admin") {
      return `Manage assignments at ${currentUserSchool?.name}`;
    } else {
      return `Create and manage your assignments at ${currentUserSchool?.name}`;
    }
  };

  const canCreateAssignments = [
    "teacher",
    "school_admin",
    "district_admin",
  ].includes(currentUserRole);

  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusColor = (assignment: Assignment) => {
    const daysUntilDue = getDaysUntilDue(assignment.due_date);

    if (assignment.status === "completed") {
      return "bg-green-100 text-green-800";
    } else if (daysUntilDue < 0) {
      return "bg-red-100 text-red-800";
    } else if (daysUntilDue <= 3) {
      return "bg-orange-100 text-orange-800";
    } else {
      return "bg-blue-100 text-blue-800";
    }
  };

  const getStatusText = (assignment: Assignment) => {
    const daysUntilDue = getDaysUntilDue(assignment.due_date);

    if (assignment.status === "completed") {
      return "Completed";
    } else if (daysUntilDue < 0) {
      return "Overdue";
    } else if (daysUntilDue === 0) {
      return "Due Today";
    } else if (daysUntilDue === 1) {
      return "Due Tomorrow";
    } else {
      return `Due in ${daysUntilDue} days`;
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
        {canCreateAssignments && (
          <Link
            href="/dashboard/assignments/create"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Assignment
          </Link>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div
          className="bg-white rounded-lg shadow-sm border-2 p-4"
          style={{ border: `2px solid ${schoolSecondaryColor}` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Total Assignments
              </p>
              <p className="text-xl font-bold text-gray-900">
                {assignmentStats.total}
              </p>
            </div>
          </div>
        </div>

        <div
          className="bg-white rounded-lg shadow-sm border-2 p-4"
          style={{ border: `2px solid ${schoolSecondaryColor}` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-xl font-bold text-gray-900">
                {assignmentStats.active}
              </p>
            </div>
          </div>
        </div>

        <div
          className="bg-white rounded-lg shadow-sm border-2 p-4"
          style={{ border: `2px solid ${schoolSecondaryColor}` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Pending Grading
              </p>
              <p className="text-xl font-bold text-gray-900">
                {assignmentStats.pendingGrading}
              </p>
            </div>
          </div>
        </div>

        <div
          className="bg-white rounded-lg shadow-sm border-2 p-4"
          style={{ border: `2px solid ${schoolSecondaryColor}` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Total Submissions
              </p>
              <p className="text-xl font-bold text-gray-900">
                {assignmentStats.totalSubmissions}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        className="bg-white rounded-lg shadow-sm border-2 p-4"
        style={{ border: `2px solid ${schoolSecondaryColor}` }}
      >
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search assignments by title, description, class, or teacher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
          </div>

          {/* Teacher Filter - Show for school/district admins */}
          {(currentUserRole === "school_admin" ||
            currentUserRole === "district_admin") &&
            teachers.length > 1 && (
              <div className="relative">
                <Users className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <select
                  value={teacherFilter}
                  onChange={(e) => setTeacherFilter(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                >
                  <option value="all">All Teachers</option>
                  {teachers.map((teacher) => (
                    <option key={teacher} value={teacher}>
                      {teacher}
                    </option>
                  ))}
                </select>
              </div>
            )}

          {/* Subject Filter */}
          {subjects.length > 0 && (
            <div className="relative">
              <BookOpen className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              >
                <option value="all">All Subjects</option>
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Group by Teacher Toggle - Show for school/district admins */}
          {(currentUserRole === "school_admin" ||
            currentUserRole === "district_admin") &&
            teachers.length > 1 && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="groupByTeacher"
                  checked={groupByTeacher}
                  onChange={(e) => setGroupByTeacher(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label
                  htmlFor="groupByTeacher"
                  className="text-sm text-gray-700"
                >
                  Group by Teacher
                </label>
              </div>
            )}

          <div className="text-sm text-gray-600 flex items-center">
            {filteredAssignments.length} of {assignments.length} assignments
          </div>
        </div>
      </div>

      {/* Assignments List */}
      {filteredAssignments.length === 0 ? (
        <div
          className="bg-white rounded-lg shadow-sm border-2 p-12 text-center"
          style={{ border: `2px solid ${schoolSecondaryColor}` }}
        >
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm ||
            subjectFilter !== "all" ||
            statusFilter !== "all" ||
            teacherFilter !== "all"
              ? "No assignments found"
              : "No assignments yet"}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm ||
            subjectFilter !== "all" ||
            statusFilter !== "all" ||
            teacherFilter !== "all"
              ? "Try adjusting your search terms or filters"
              : "Create your first assignment to get started"}
          </p>
          {!searchTerm &&
            subjectFilter === "all" &&
            statusFilter === "all" &&
            teacherFilter === "all" &&
            canCreateAssignments && (
              <Link
                href="/dashboard/assignments/create"
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create First Assignment
              </Link>
            )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedAssignments).map(
            ([groupName, groupAssignments]) => (
              <div key={groupName}>
                {groupByTeacher && groupName !== "All Assignments" && (
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      {groupName}
                      <span className="text-sm font-normal text-gray-500">
                        ({groupAssignments.length} assignment
                        {groupAssignments.length !== 1 ? "s" : ""})
                      </span>
                    </h2>
                    <div className="h-px bg-gray-200 mt-2"></div>
                  </div>
                )}
                <div className="space-y-4">
                  {groupAssignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="bg-white rounded-lg shadow-sm border-2 p-6 hover:shadow-md transition-shadow"
                      style={{ border: `2px solid ${schoolSecondaryColor}` }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <FileText className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                    {assignment.title}
                                  </h3>
                                  <p className="text-gray-600 mb-3 line-clamp-2">
                                    {assignment.description}
                                  </p>
                                  <div className="flex items-center gap-4 text-sm text-gray-500">
                                    {(currentUserRole === "school_admin" ||
                                      currentUserRole === "district_admin") &&
                                      !groupByTeacher && (
                                        <div className="flex items-center gap-1">
                                          <Users className="w-4 h-4" />
                                          <span>{assignment.teacher_name}</span>
                                        </div>
                                      )}
                                    <div className="flex items-center gap-1">
                                      <BookOpen className="w-4 h-4" />
                                      <span>{assignment.class_name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Calendar className="w-4 h-4" />
                                      <span>
                                        Due{" "}
                                        {new Date(
                                          assignment.due_date
                                        ).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Users className="w-4 h-4" />
                                      <span>
                                        {assignment.submissions_count}/
                                        {assignment.total_students} submitted
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                                      assignment
                                    )}`}
                                  >
                                    {getStatusText(assignment)}
                                  </span>
                                  {canCreateAssignments ? (
                                    <div className="flex items-center gap-1">
                                      <Link
                                        href={`/dashboard/assignments/${assignment.id}`}
                                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                        title="View assignment"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </Link>
                                      <Link
                                        href={`/dashboard/assignments/${assignment.id}/edit`}
                                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                        title="Edit assignment"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Link>
                                      <button
                                        onClick={() =>
                                          handleDelete(
                                            assignment.id,
                                            assignment.title
                                          )
                                        }
                                        disabled={deletingId === assignment.id}
                                        className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                                        title="Delete assignment"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    // Student view - Open Assignment button
                                    <div className="flex items-center gap-2">
                                      <Link
                                        href={`/dashboard/assignments/${assignment.id}`}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                      >
                                        Open Assignment
                                      </Link>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
