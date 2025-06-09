// components/dashboard/assignments/AssignmentDetail.tsx
"use client";

import { useState } from "react";
import { ArrowLeft, Edit, Trash2, Calendar, User, Building, FileText, Play, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRole, createClient } from "@/lib/supabase";

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  created_at: string;
  teacher_id: string;
  district_id: string;
  school_id: string;
}

interface AssignmentDetailProps {
  assignment: Assignment;
  currentUserRole: UserRole;
  currentUserId: string;
  currentUserSchool?: { id: string; name: string } | null;
  districtName: string;
}

export default function AssignmentDetail({
  assignment,
  currentUserRole,
  currentUserId,
  currentUserSchool,
  districtName,
}: AssignmentDetailProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const canEdit = assignment.teacher_id === currentUserId;
  const canDelete = assignment.teacher_id === currentUserId;

  const handleDelete = async () => {
    if (!canDelete) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this assignment? This action cannot be undone."
    );

    if (!confirmed) return;

    setDeleting(true);

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("assignments")
        .delete()
        .eq("id", assignment.id);

      if (error) {
        console.error("Error deleting assignment:", error);
        alert(`Error deleting assignment: ${error.message}`);
        setDeleting(false);
        return;
      }

      // Navigate back to assignments page after successful deletion
      router.push("/dashboard/assignments");
    } catch (error: any) {
      console.error("Error deleting assignment:", error);
      alert(`Error deleting assignment: ${error?.message || 'Unknown error'}`);
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getPageTitle = () => {
    if (currentUserRole === "district_admin") {
      return "Assignment Details";
    } else if (currentUserRole === "school_admin") {
      return "Assignment Details";
    } else {
      return "My Assignment";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/assignments"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Assignments
          </Link>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {currentUserRole === "student" ? (
            // Student view - Start/Continue assignment
            <div className="flex items-center gap-3">
              <Link
                href={`/dashboard/assignments/${assignment.id}/start`}
                className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <Play className="w-5 h-5" />
                Start Assignment
              </Link>
              <button className="flex items-center gap-2 bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors">
                <RotateCcw className="w-4 h-4" />
                Reset Progress
              </button>
            </div>
          ) : (
            // Teacher/Admin view - Edit/Delete
            <>
              {canEdit && (
                <Link
                  href={`/dashboard/assignments/${assignment.id}/edit`}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </Link>
              )}
              {canDelete && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">{getPageTitle()}</h1>
        <p className="text-gray-600 mt-1">View assignment details and manage settings</p>
      </div>

      {/* Assignment Details */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        {/* Assignment Header */}
        <div className="border-b border-gray-200 pb-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{assignment.title}</h2>
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Due: {formatDate(assignment.due_date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>Created: {formatDate(assignment.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Assignment Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Assignment Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <p className="text-gray-900">{assignment.title}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <p className="text-gray-900">
                    {assignment.description || "No description provided"}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date
                  </label>
                  <p className="text-gray-900">{formatDate(assignment.due_date)}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Writing Prompt
                  </label>
                  <p className="text-gray-900">
                    {(assignment as any).prompt || "No prompt provided"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Assignment Info</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assignment Type
                  </label>
                  <p className="text-gray-900">Literary - Response to Literature</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    School
                  </label>
                  <p className="text-gray-900">{currentUserSchool?.name || "Unknown School"}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    District
                  </label>
                  <p className="text-gray-900">{districtName}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Assignment Statistics */}
        {currentUserRole !== "student" && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Assignment Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-600">Total Students</p>
                    <p className="text-xl font-bold text-blue-900">0</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-600">Submissions</p>
                    <p className="text-xl font-bold text-green-900">0</p>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-orange-600">Pending</p>
                    <p className="text-xl font-bold text-orange-900">0</p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Building className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-purple-600">Graded</p>
                    <p className="text-xl font-bold text-purple-900">0</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Student Progress Section */}
        {currentUserRole === "student" && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Progress</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Play className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-600">Status</p>
                    <p className="text-xl font-bold text-blue-900">Not Started</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-600">Progress</p>
                    <p className="text-xl font-bold text-green-900">0%</p>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-orange-600">Time Remaining</p>
                    <p className="text-xl font-bold text-orange-900">
                      {Math.ceil((new Date(assignment.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Future Features Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Assignment Management Features
          </h3>
          <p className="text-blue-800 mb-4">
            Additional assignment management features will be added here as the system develops.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-blue-700">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>Student enrollment and management</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>Submission tracking and grading</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Progress monitoring and analytics</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
