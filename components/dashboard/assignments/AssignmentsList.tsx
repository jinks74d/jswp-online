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
}

export default function AssignmentsList({
  assignments,
  currentUserRole,
  currentUserSchool,
  districtName,
}: AssignmentsListProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (assignmentId: string, assignmentTitle: string) => {
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error deleting assignment: ${errorMessage}`);
      setDeletingId(null);
    }
  };

  const filteredAssignments = assignments.filter((assignment) => {
    const matchesSearch =
      assignment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.class_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSubject =
      subjectFilter === "all" || assignment.subject === subjectFilter;

    const matchesStatus =
      statusFilter === "all" || assignment.status === statusFilter;

    return matchesSearch && matchesSubject && matchesStatus;
  });

  // Get unique subjects for filtering
  const subjects = Array.from(
    new Set(assignments.map((a) => a.subject))
  ).sort();

  const assignmentStats = {
    total: assignments.length,
    active: assignments.filter((a) => a.status === "active").length,
    completed: assignments.filter((a) => a.status === "completed").length,
    overdue: assignments.filter((a) => {
      const dueDate = new Date(a.due_date);
      const today = new Date();
      return dueDate < today && a.status === "active";
    }).length,
    totalSubmissions: assignments.reduce((sum, a) => sum + a.submissions_count, 0),
    pendingGrading: assignments.reduce((sum, a) => sum + (a.total_students - a.submissions_count), 0),
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

  const canCreateAssignments = ["teacher", "school_admin", "district_admin"].includes(
    currentUserRole
  );

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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Assignments</p>
              <p className="text-xl font-bold text-gray-900">{assignmentStats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-xl font-bold text-gray-900">{assignmentStats.active}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Grading</p>
              <p className="text-xl font-bold text-gray-900">{assignmentStats.pendingGrading}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Submissions</p>
              <p className="text-xl font-bold text-gray-900">{assignmentStats.totalSubmissions}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search assignments by title, description, or class..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
          </div>

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

          <div className="text-sm text-gray-600 flex items-center">
            {filteredAssignments.length} of {assignments.length} assignments
          </div>
        </div>
      </div>

      {/* Assignments List */}
      {filteredAssignments.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm || subjectFilter !== "all" || statusFilter !== "all"
              ? "No assignments found"
              : "No assignments yet"}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || subjectFilter !== "all" || statusFilter !== "all"
              ? "Try adjusting your search terms or filters"
              : "Create your first assignment to get started"}
          </p>
          {!searchTerm && subjectFilter === "all" && statusFilter === "all" && canCreateAssignments && (
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
        <div className="space-y-4">
          {filteredAssignments.map((assignment) => (
            <div
              key={assignment.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
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
                            <div className="flex items-center gap-1">
                              <BookOpen className="w-4 h-4" />
                              <span>{assignment.class_name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>Due {new Date(assignment.due_date).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              <span>{assignment.submissions_count}/{assignment.total_students} submitted</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(assignment)}`}>
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
                                onClick={() => handleDelete(assignment.id, assignment.title)}
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
      )}

      {/* Coming Soon Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-blue-900">
            Assignment System Coming Soon
          </h3>
        </div>
        <p className="text-blue-800 mb-4">
          We&apos;re building a comprehensive assignment management system! The assignments shown above are preview data to demonstrate the interface.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-blue-700">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>Rich assignment creation with attachments</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>Student submission tracking</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>Automated grading and feedback</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>Due date reminders and notifications</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Real-time progress monitoring</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>Detailed analytics and reporting</span>
          </div>
        </div>
      </div>
    </div>
  );
}
