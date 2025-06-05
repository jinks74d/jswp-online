// components/dashboard/students/StudentTeacherAssignments.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import {
  Plus,
  X,
  GraduationCap,
  Calendar,
  User,
  AlertCircle,
  CheckCircle,
  BookOpen,
} from "lucide-react";
import { UserRole } from "@/lib/supabase";

interface Teacher {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  schools?: { id: string; name: string }[] | { id: string; name: string } | null;
}

interface Assignment {
  id: string;
  teacher_id: string;
  subject: string | null;
  assigned_date: string;
  assigned_by: string | null;
  status: string;
  notes: string | null;
  teacher: Teacher;
}

interface StudentTeacherAssignmentsProps {
  studentId: string;
  currentUserRole: UserRole;
  currentUserSchoolId?: string | null;
  districtId: string;
}

export default function StudentTeacherAssignments({
  studentId,
  currentUserRole,
  currentUserSchoolId,
  districtId,
}: StudentTeacherAssignmentsProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    teacherId: "",
    subject: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchAssignments();
    fetchAvailableTeachers();
  }, [studentId]);

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from("teacher_student_assignments")
        .select(
          `
          *,
          teacher:teacher_id(
            id,
            first_name,
            last_name,
            email,
            schools:school_id(id, name)
          )
        `
        )
        .eq("student_id", studentId)
        .eq("status", "active")
        .order("assigned_date", { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error("Error fetching assignments:", error);
    }
  };

  const fetchAvailableTeachers = async () => {
    try {
      let query = supabase
        .from("user_profiles")
        .select(
          `
          id,
          first_name,
          last_name,
          email,
          schools:school_id(id, name)
        `
        )
        .eq("role", "teacher")
        .eq("district_id", districtId);

      // School admins and teachers can only assign teachers from their school
      if (
        (currentUserRole === "school_admin" || currentUserRole === "teacher") &&
        currentUserSchoolId
      ) {
        query = query.eq("school_id", currentUserSchoolId);
      }

      const { data, error } = await query.order("first_name");

      if (error) throw error;
      setAvailableTeachers((data || []) as Teacher[]);
    } catch (error) {
      console.error("Error fetching teachers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAssignment = async () => {
    if (!newAssignment.teacherId) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("teacher_student_assignments")
        .insert({
          teacher_id: newAssignment.teacherId,
          student_id: studentId,
          subject: newAssignment.subject || null,
          notes: newAssignment.notes || null,
          status: "active",
        });

      if (error) throw error;

      // Refresh assignments
      await fetchAssignments();

      // Reset form
      setNewAssignment({ teacherId: "", subject: "", notes: "" });
      setShowAddForm(false);
    } catch (error) {
      console.error("Error adding assignment:", error);
      alert("Failed to add teacher assignment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm("Are you sure you want to remove this teacher assignment?"))
      return;

    try {
      const { error } = await supabase
        .from("teacher_student_assignments")
        .update({ status: "inactive" })
        .eq("id", assignmentId);

      if (error) throw error;

      // Refresh assignments
      await fetchAssignments();
    } catch (error) {
      console.error("Error removing assignment:", error);
      alert("Failed to remove teacher assignment");
    }
  };

  const canManageAssignments = ["district_admin", "school_admin"].includes(
    currentUserRole
  );

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600">Loading teacher assignments...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Assigned Teachers
            </h3>
          </div>
          {canManageAssignments && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Teacher
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {assignments.length === 0 ? (
          <div className="text-center py-8">
            <GraduationCap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              No teacher assignments
            </h4>
            <p className="text-gray-600 mb-4">
              This student hasn&apos;t been assigned to any teachers yet
            </p>
            {canManageAssignments && (
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Assign First Teacher
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {assignment.teacher.first_name}{" "}
                      {assignment.teacher.last_name}
                    </h4>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{assignment.teacher.email}</span>
                      {assignment.subject && (
                        <div className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          <span>{assignment.subject}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                      <Calendar className="w-3 h-3" />
                      Assigned{" "}
                      {new Date(assignment.assigned_date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Active
                  </span>
                  {canManageAssignments && (
                    <button
                      onClick={() => handleRemoveAssignment(assignment.id)}
                      className="text-red-600 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50"
                      title="Remove assignment"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Assignment Form */}
        {showAddForm && (
          <div className="mt-6 p-4 border border-blue-200 rounded-lg bg-blue-50">
            <h4 className="font-medium text-gray-900 mb-4">Assign Teacher</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teacher *
                </label>
                <select
                  value={newAssignment.teacherId}
                  onChange={(e) =>
                    setNewAssignment((prev) => ({
                      ...prev,
                      teacherId: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Select a teacher</option>
                  {availableTeachers
                    .filter(
                      (teacher) =>
                        !assignments.some((a) => a.teacher_id === teacher.id)
                    )
                    .map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.first_name} {teacher.last_name} -{" "}
                        {teacher.email}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject/Class (Optional)
                </label>
                <input
                  type="text"
                  value={newAssignment.subject}
                  onChange={(e) =>
                    setNewAssignment((prev) => ({
                      ...prev,
                      subject: e.target.value,
                    }))
                  }
                  placeholder="e.g., Mathematics, English Literature, Biology"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={newAssignment.notes}
                  onChange={(e) =>
                    setNewAssignment((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  placeholder="Any additional notes about this assignment..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleAddAssignment}
                  disabled={!newAssignment.teacherId || submitting}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {submitting ? "Adding..." : "Add Assignment"}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewAssignment({ teacherId: "", subject: "", notes: "" });
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
