// components/dashboard/classes/ClassDetail.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import {
  ArrowLeft,
  BookOpen,
  Users,
  Calendar,
  Clock,
  Edit,
  Trash2,
  UserPlus,
  FileText,
  Settings,
  School,
  GraduationCap,
  X,
  Search,
  AlertCircle,
  Check,
} from "lucide-react";
import Link from "next/link";
import { UserProfile } from "@/lib/supabase";

interface ClassPeriod {
  id: string;
  period: string;
  school_id: string;
  created_at: string;
  created_by: string;
  classes: {
    id: string;
    name: string;
    subjects: {
      id: string;
      name: string;
      description?: string;
    };
  };
}

interface ClassDetailProps {
  classPeriod: ClassPeriod;
  profile: UserProfile & {
    districts?: { id: string; name: string; domain: string | null };
    schools?: { id: string; name: string };
  };
}

interface EnrolledStudent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
}

interface AssignedTeacher {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
}

interface AvailableTeacher {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface AvailableStudent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export default function ClassDetail({ classPeriod, profile }: ClassDetailProps) {
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [assignedTeachers, setAssignedTeachers] = useState<AssignedTeacher[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<AvailableTeacher[]>([]);
  const [availableStudents, setAvailableStudents] = useState<AvailableStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignTeacherModal, setShowAssignTeacherModal] = useState(false);
  const [showEnrollStudentModal, setShowEnrollStudentModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [assigningTeacher, setAssigningTeacher] = useState(false);
  const [enrollingStudent, setEnrollingStudent] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const supabase = createClient();

  useEffect(() => {
    fetchClassData();
  }, []);

  const fetchClassData = async () => {
    try {
      // Fetch assigned teachers for this class
      const { data: teacherAssignments, error: teachersError } = await supabase
        .from("class_teacher_assignments")
        .select(`
          id,
          created_at,
          teacher:teacher_id(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq("class_period_id", classPeriod.id);

      if (teachersError) {
        console.error("Error fetching teachers:", teachersError);
      } else {
        const teachers = teacherAssignments?.map((assignment: any) => ({
          id: assignment.teacher.id,
          first_name: assignment.teacher.first_name,
          last_name: assignment.teacher.last_name,
          email: assignment.teacher.email,
          created_at: assignment.created_at,
        })) || [];
        setAssignedTeachers(teachers);
      }

      // Fetch enrolled students for this class
      const { data: studentEnrollments, error: studentsError } = await supabase
        .from("class_student_enrollments")
        .select(`
          id,
          created_at,
          student:student_id(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq("class_period_id", classPeriod.id);

      if (studentsError) {
        console.error("Error fetching students:", studentsError);
      } else {
        const students = studentEnrollments?.map((enrollment: any) => ({
          id: enrollment.student.id,
          first_name: enrollment.student.first_name,
          last_name: enrollment.student.last_name,
          email: enrollment.student.email,
          created_at: enrollment.created_at,
        })) || [];
        setEnrolledStudents(students);
      }
    } catch (error) {
      console.error("Error fetching class data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTeachers = async () => {
    try {
      // Get all teachers in the school who are not already assigned to this class
      const assignedTeacherIds = assignedTeachers.map(t => t.id);
      
      let query = supabase
        .from("user_profiles")
        .select("id, first_name, last_name, email")
        .eq("role", "teacher")
        .eq("school_id", classPeriod.school_id);

      if (assignedTeacherIds.length > 0) {
        query = query.not("id", "in", `(${assignedTeacherIds.join(",")})`);
      }

      const { data: teachers, error } = await query;

      if (error) {
        console.error("Error fetching available teachers:", error);
        setError("Failed to load available teachers");
      } else {
        setAvailableTeachers(teachers || []);
      }
    } catch (error) {
      console.error("Error fetching available teachers:", error);
      setError("Failed to load available teachers");
    }
  };

  const handleAssignTeacher = async (teacherId: string) => {
    setAssigningTeacher(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/dashboard/classes/${classPeriod.id}/assign-teacher`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ teacherId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to assign teacher");
      }

      setSuccess("Teacher assigned successfully!");
      
      // Refresh the class data to show the new teacher
      await fetchClassData();
      
      // Close the modal after a short delay
      setTimeout(() => {
        setShowAssignTeacherModal(false);
        setSuccess("");
        setSearchTerm("");
      }, 2000);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setAssigningTeacher(false);
    }
  };

  const handleUnassignTeacher = async (teacherId: string) => {
    if (!confirm("Are you sure you want to unassign this teacher from the class?")) {
      return;
    }

    try {
      const response = await fetch(`/api/dashboard/classes/${classPeriod.id}/assign-teacher`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ teacherId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to unassign teacher");
      }

      setSuccess("Teacher unassigned successfully!");
      
      // Refresh the class data
      await fetchClassData();
      
      // Clear success message after delay
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (error: any) {
      setError(error.message);
      setTimeout(() => {
        setError("");
      }, 5000);
    }
  };

  const openAssignTeacherModal = () => {
    setShowAssignTeacherModal(true);
    setError("");
    setSuccess("");
    fetchAvailableTeachers();
  };

  const fetchAvailableStudents = async () => {
    try {
      // Get all students in the school who are not already enrolled in this class
      const enrolledStudentIds = enrolledStudents.map(s => s.id);
      
      let query = supabase
        .from("user_profiles")
        .select("id, first_name, last_name, email")
        .eq("role", "student")
        .eq("school_id", classPeriod.school_id);

      if (enrolledStudentIds.length > 0) {
        query = query.not("id", "in", `(${enrolledStudentIds.join(",")})`);
      }

      const { data: students, error } = await query;

      if (error) {
        console.error("Error fetching available students:", error);
        setError("Failed to load available students");
      } else {
        setAvailableStudents(students || []);
      }
    } catch (error) {
      console.error("Error fetching available students:", error);
      setError("Failed to load available students");
    }
  };

  const handleEnrollStudent = async (studentId: string) => {
    setEnrollingStudent(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/dashboard/classes/${classPeriod.id}/enroll-student`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studentId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to enroll student");
      }

      setSuccess("Student enrolled successfully!");
      
      // Refresh the class data to show the new student
      await fetchClassData();
      
      // Close the modal after a short delay
      setTimeout(() => {
        setShowEnrollStudentModal(false);
        setSuccess("");
        setStudentSearchTerm("");
      }, 2000);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setEnrollingStudent(false);
    }
  };

  const openEnrollStudentModal = () => {
    setShowEnrollStudentModal(true);
    setError("");
    setSuccess("");
    fetchAvailableStudents();
  };

  const filteredTeachers = availableTeachers.filter(teacher =>
    `${teacher.first_name} ${teacher.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredStudents = availableStudents.filter(student =>
    `${student.first_name} ${student.last_name}`.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(studentSearchTerm.toLowerCase())
  );

  const canManageClass = ["school_admin", "district_admin"].includes(profile.role);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600">Loading class details...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/classes"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Classes
        </Link>
      </div>

      {/* Class Overview Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {classPeriod.classes.name}
              </h1>
              <p className="text-gray-600">
                {classPeriod.classes.subjects.name} • Period {classPeriod.period}
              </p>
              <p className="text-sm text-gray-500">
                {profile.schools?.name}
              </p>
            </div>
          </div>
          {canManageClass && (
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                <Edit className="w-4 h-4" />
                Edit Class
              </button>
              <button className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors">
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Class Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Subject Information</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600">
                  <School className="w-4 h-4" />
                  <span>{classPeriod.classes.subjects.name}</span>
                </div>
                {classPeriod.classes.subjects.description && (
                  <p className="text-sm text-gray-600 ml-6">
                    {classPeriod.classes.subjects.description}
                  </p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Class Details</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600">
                  <BookOpen className="w-4 h-4" />
                  <span>Class: {classPeriod.classes.name}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>Period: {classPeriod.period}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Created</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(classPeriod.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">School</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600">
                  <School className="w-4 h-4" />
                  <span>{profile.schools?.name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Students</p>
              <p className="text-xl font-bold text-gray-900">{enrolledStudents.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Teachers</p>
              <p className="text-xl font-bold text-gray-900">{assignedTeachers.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Assignments</p>
              <p className="text-xl font-bold text-gray-900">0</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Sessions</p>
              <p className="text-xl font-bold text-gray-900">0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Enrolled Students */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Enrolled Students
              </h2>
              {canManageClass && (
                <button 
                  onClick={openEnrollStudentModal}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Students
                </button>
              )}
            </div>
          </div>
          <div className="p-6">
            {enrolledStudents.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No students enrolled
                </h3>
                <p className="text-gray-600 mb-4">
                  Students will appear here when they're enrolled in this class
                </p>
                {canManageClass && (
                  <button 
                    onClick={openEnrollStudentModal}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Enroll Students
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {enrolledStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {student.first_name} {student.last_name}
                        </h3>
                        <p className="text-sm text-gray-600">{student.email}</p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      Enrolled {new Date(student.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Assigned Teachers */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Assigned Teachers
              </h2>
              {canManageClass && (
                <button 
                  onClick={openAssignTeacherModal}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  <UserPlus className="w-4 h-4" />
                  Assign Teachers
                </button>
              )}
            </div>
          </div>
          <div className="p-6">
            {assignedTeachers.length === 0 ? (
              <div className="text-center py-8">
                <GraduationCap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No teachers assigned
                </h3>
                <p className="text-gray-600 mb-4">
                  Teachers will appear here when they're assigned to this class
                </p>
                {canManageClass && (
                  <button 
                    onClick={openAssignTeacherModal}
                    className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Assign Teachers
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {assignedTeachers.map((teacher) => (
                  <div
                    key={teacher.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <GraduationCap className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {teacher.first_name} {teacher.last_name}
                        </h3>
                        <p className="text-sm text-gray-600">{teacher.email}</p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      Assigned {new Date(teacher.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {canManageClass && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button 
              onClick={openEnrollStudentModal}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-gray-900">Enroll Students</h3>
                <p className="text-sm text-gray-600">Add students to this class</p>
              </div>
            </button>

            <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-gray-900">Assign Teachers</h3>
                <p className="text-sm text-gray-600">Add teachers to this class</p>
              </div>
            </button>

            <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-gray-900">Create Assignment</h3>
                <p className="text-sm text-gray-600">Add new assignments</p>
              </div>
            </button>

            <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Settings className="w-5 h-5 text-orange-600" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-gray-900">Class Settings</h3>
                <p className="text-sm text-gray-600">Configure class options</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Coming Soon Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-blue-900">
            Class Management Features Coming Soon
          </h3>
        </div>
        <p className="text-blue-800 mb-4">
          Advanced class management features are in development! The class structure is ready for future enhancements.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-blue-700">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>Student enrollment and management</span>
          </div>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            <span>Teacher assignment system</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>Assignment creation and tracking</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>Attendance and session management</span>
          </div>
        </div>
      </div>

      {/* Assign Teacher Modal */}
      {showAssignTeacherModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Assign Teacher</h3>
              <button
                onClick={() => setShowAssignTeacherModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Error/Success Messages */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-3 mb-4">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-start gap-3 mb-4">
                  <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-green-800">Success</h3>
                    <p className="text-sm text-green-700 mt-1">{success}</p>
                  </div>
                </div>
              )}

              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search teachers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
              </div>

              {/* Teachers List */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredTeachers.length === 0 ? (
                  <div className="text-center py-8">
                    <GraduationCap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {searchTerm ? "No teachers found" : "No available teachers"}
                    </h3>
                    <p className="text-gray-600">
                      {searchTerm 
                        ? "Try adjusting your search terms"
                        : "All teachers in this school are already assigned to this class"
                      }
                    </p>
                  </div>
                ) : (
                  filteredTeachers.map((teacher) => (
                    <div
                      key={teacher.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <GraduationCap className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {teacher.first_name} {teacher.last_name}
                          </h3>
                          <p className="text-sm text-gray-600">{teacher.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAssignTeacher(teacher.id)}
                        disabled={assigningTeacher}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {assigningTeacher ? "Assigning..." : "Assign"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowAssignTeacherModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enroll Student Modal */}
      {showEnrollStudentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Enroll Student</h3>
              <button
                onClick={() => setShowEnrollStudentModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Error/Success Messages */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-3 mb-4">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-start gap-3 mb-4">
                  <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-green-800">Success</h3>
                    <p className="text-sm text-green-700 mt-1">{success}</p>
                  </div>
                </div>
              )}

              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={studentSearchTerm}
                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
              </div>

              {/* Students List */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {studentSearchTerm ? "No students found" : "No available students"}
                    </h3>
                    <p className="text-gray-600">
                      {studentSearchTerm 
                        ? "Try adjusting your search terms"
                        : "All students in this school are already enrolled in this class"
                      }
                    </p>
                  </div>
                ) : (
                  filteredStudents.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {student.first_name} {student.last_name}
                          </h3>
                          <p className="text-sm text-gray-600">{student.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleEnrollStudent(student.id)}
                        disabled={enrollingStudent}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {enrollingStudent ? "Enrolling..." : "Enroll"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowEnrollStudentModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
