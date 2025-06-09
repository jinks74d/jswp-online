// components/dashboard/TeacherDashboard.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
  Users,
  BookOpen,
  FileText,
  Calendar,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { UserProfile } from "@/lib/supabase";

interface TeacherStats {
  totalClasses: number;
  totalStudents: number;
  totalAssignments: number;
  pendingGrading: number;
  recentAssignments: any[];
  upcomingDueDates: any[];
}

interface TeacherDashboardProps {
  profile: UserProfile & {
    districts?: { id: string; name: string; domain: string | null };
    schools?: { id: string; name: string };
  };
}

export default function TeacherDashboard({ profile }: TeacherDashboardProps) {
  const [stats, setStats] = useState<TeacherStats>({
    totalClasses: 0,
    totalStudents: 0,
    totalAssignments: 0,
    pendingGrading: 0,
    recentAssignments: [],
    upcomingDueDates: [],
  });
  const [loading, setLoading] = useState(true);

  const [assignedStudents, setAssignedStudents] = useState<any[]>([]);
  const [availableStudents, setAvailableStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [addingStudent, setAddingStudent] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchTeacherStats();
    fetchAssignedStudents();
  }, []);

  const fetchAssignedStudents = async () => {
    try {
      // First get class periods where this teacher is assigned
      const { data: teacherClassPeriods } = await supabase
        .from("class_teacher_assignments")
        .select("class_period_id")
        .eq("teacher_id", profile.id);

      if (!teacherClassPeriods || teacherClassPeriods.length === 0) {
        setAssignedStudents([]);
        return;
      }

      const classPeriodIds = teacherClassPeriods.map(tc => tc.class_period_id);

      // Get students enrolled in those classes
      const { data: studentsData } = await supabase
        .from("class_student_enrollments")
        .select(`
          *,
          student:student_id(
            id,
            first_name,
            last_name,
            email
          ),
          class_period:class_period_id(
            id,
            period,
            classes:class_id(
              id,
              name,
              subjects:subject_id(
                id,
                name
              )
            )
          )
        `)
        .in("class_period_id", classPeriodIds)
        .order("created_at", { ascending: false })
        .limit(20);

      // Group students by class and sort
      const groupedStudents = (studentsData || []).reduce((acc: any, enrollment: any) => {
        const className = `${enrollment.class_period.classes.name} - Period ${enrollment.class_period.period}`;
        if (!acc[className]) {
          acc[className] = [];
        }
        acc[className].push({
          ...enrollment,
          className,
          subject: enrollment.class_period.classes.subjects.name,
        });
        return acc;
      }, {});

      // Keep grouped structure for display
      setAssignedStudents(groupedStudents);
    } catch (error) {
      console.error("Error fetching assigned students:", error);
    }
  };

  const fetchAvailableStudents = async () => {
    try {
      // Get all students in the school who are not already enrolled in teacher's classes
      const enrolledStudentIds = assignedStudents.map(s => s.student.id);
      
      let query = supabase
        .from("user_profiles")
        .select("id, first_name, last_name, email")
        .eq("role", "student")
        .eq("school_id", profile.school_id);

      if (enrolledStudentIds.length > 0) {
        query = query.not("id", "in", `(${enrolledStudentIds.join(",")})`);
      }

      const { data: students, error } = await query;

      if (error) {
        console.error("Error fetching available students:", error);
      } else {
        setAvailableStudents(students || []);
      }
    } catch (error) {
      console.error("Error fetching available students:", error);
    }
  };

  const handleAddStudent = async () => {
    if (!selectedStudentId) return;
    
    setAddingStudent(true);
    // TODO: Implement student assignment logic
    console.log("Adding student:", selectedStudentId);
    
    // Reset selection
    setSelectedStudentId("");
    setAddingStudent(false);
  };

  useEffect(() => {
    if (assignedStudents.length > 0) {
      fetchAvailableStudents();
    }
  }, [assignedStudents]);

  const fetchTeacherStats = async () => {
    try {
      // Get actual assigned students count
      const { count: assignedStudentsCount } = await supabase
        .from("teacher_student_assignments")
        .select("*", { count: "exact", head: true })
        .eq("teacher_id", profile.id)
        .eq("status", "active");

      // Get classes assigned to this teacher
      const { data: teacherClasses, count: classesCount } = await supabase
        .from("class_teacher_assignments")
        .select(`
          *,
          class_period:class_period_id(
            id,
            period,
            classes(
              id,
              name,
              subjects(
                id,
                name
              )
            )
          )
        `, { count: "exact" })
        .eq("teacher_id", profile.id);

      // Get real assignments created by this teacher
      const { data: recentAssignmentsData, count: assignmentsCount } = await supabase
        .from("assignments")
        .select("*", { count: "exact" })
        .eq("teacher_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(5);

      // Calculate pending grading (for now, use a simple calculation)
      const pendingCount = Math.floor((assignmentsCount || 0) * 0.3); // Assume 30% need grading

      // Transform real assignment data for display
      const transformedAssignments = (recentAssignmentsData || []).map(assignment => ({
        id: assignment.id,
        title: assignment.title,
        classes: { name: "Literary Assignment" }, // Default since we don't have class info yet
        due_date: assignment.due_date,
        created_at: assignment.created_at,
        _count: [{ count: 0 }], // Default submission count
      }));

      // Get upcoming assignments (assignments with future due dates)
      const upcomingAssignments = (recentAssignmentsData || [])
        .filter(assignment => assignment.due_date && new Date(assignment.due_date) > new Date())
        .slice(0, 3)
        .map(assignment => ({
          id: assignment.id,
          title: assignment.title,
          classes: { name: "Literary Assignment" },
          due_date: assignment.due_date,
        }));

      setStats({
        totalClasses: classesCount || 0,
        totalStudents: assignedStudentsCount || 0,
        totalAssignments: assignmentsCount || 0,
        pendingGrading: pendingCount,
        recentAssignments: transformedAssignments,
        upcomingDueDates: upcomingAssignments,
      });
    } catch (error) {
      console.error("Error fetching teacher stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      name: "My Classes",
      value: stats.totalClasses,
      icon: BookOpen,
      color: "bg-blue-500",
      href: "/dashboard/classes",
      change: null,
    },
    {
      name: "Students",
      value: stats.totalStudents,
      icon: Users,
      color: "bg-green-500",
      href: "/dashboard/students",
      change: null,
    },
    {
      name: "Assignments",
      value: stats.totalAssignments,
      icon: FileText,
      color: "bg-purple-500",
      href: "/dashboard/assignments",
      change: null,
    },
    {
      name: "Pending Grading",
      value: stats.pendingGrading,
      icon: Clock,
      color: "bg-orange-500",
      href: "/dashboard/assignments?filter=pending",
      change: null,
    },
  ];

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Teacher Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Welcome back, {profile.first_name}!{" "}
            {profile.schools?.name && `Teaching at ${profile.schools.name}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/classes"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <BookOpen className="w-5 h-5" />
            My Classes
          </Link>
          <Link
            href="/dashboard/assignments"
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <FileText className="w-5 h-5" />
            Assignments
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.name}
              href={stat.href}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.color} rounded-lg p-3`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                {stat.name === "Pending Grading" && stat.value > 0 && (
                  <div className="flex items-center gap-1 text-orange-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Needs attention
                  </div>
                )}
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
        {/* Assigned Students */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                My Students
              </h2>
              <Link
                href="/dashboard/students"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                View all
              </Link>
            </div>
          </div>
          <div className="p-6">
            {Object.keys(assignedStudents).length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No students assigned
                </h3>
                <p className="text-gray-600 mb-4">
                  Students will appear here when they're assigned to you
                </p>
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
                    className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {addingStudent ? "Adding..." : "Add"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.keys(assignedStudents).sort().map((className) => (
                  <div key={className} className="space-y-2">
                    {/* Class Header */}
                    <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                      <BookOpen className="w-4 h-4 text-blue-600" />
                      <h4 className="text-sm font-medium text-gray-900">{className}</h4>
                      <span className="text-xs text-gray-500">({assignedStudents[className].length} students)</span>
                    </div>
                    
                    {/* Students in this class */}
                    <div className="space-y-1 ml-6">
                      {assignedStudents[className].map((assignment: any) => (
                        <div
                          key={assignment.id}
                          className="flex items-center justify-between p-1.5 hover:bg-gray-50 rounded transition-colors"
                        >
                          <Link
                            href={`/dashboard/students/${assignment.student.id}`}
                            className="text-sm text-gray-900 hover:text-blue-600 transition-colors"
                          >
                            {assignment.student.first_name} {assignment.student.last_name}
                          </Link>
                          <div className="text-xs text-gray-400">
                            {new Date(assignment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {/* Show more students indicator */}
                <div className="text-center pt-2 border-t border-gray-100">
                  <Link
                    href="/dashboard/students"
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View all {stats.totalStudents} students →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Assignments */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Assignments
              </h2>
              <Link
                href="/dashboard/assignments"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                View all
              </Link>
            </div>
          </div>
          <div className="p-6">
            {stats.recentAssignments.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No assignments yet
                </h3>
                <p className="text-gray-600 mb-4">
                  Create your first assignment to get started
                </p>
                <Link
                  href="/dashboard/assignments/create"
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Assignment
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.recentAssignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {assignment.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">
                            {assignment.classes?.name || "No class"}
                          </span>
                          {assignment.due_date && (
                            <span className="text-xs text-gray-500">
                              • Due{" "}
                              {new Date(
                                assignment.due_date
                              ).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Users className="w-4 h-4" />
                        {assignment._count?.[0]?.count || 0} submissions
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Due Dates */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Upcoming Due Dates
              </h2>
              <Link
                href="/dashboard/assignments"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                View calendar
              </Link>
            </div>
          </div>
          <div className="p-6">
            {stats.upcomingDueDates.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No upcoming deadlines
                </h3>
                <p className="text-gray-600">
                  All caught up! No assignments due soon.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.upcomingDueDates.map((assignment) => {
                  const dueDate = new Date(assignment.due_date);
                  const today = new Date();
                  const daysUntilDue = Math.ceil(
                    (dueDate.getTime() - today.getTime()) /
                      (1000 * 60 * 60 * 24)
                  );

                  return (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            daysUntilDue <= 1
                              ? "bg-red-100"
                              : daysUntilDue <= 3
                              ? "bg-orange-100"
                              : "bg-green-100"
                          }`}
                        >
                          <Calendar
                            className={`w-5 h-5 ${
                              daysUntilDue <= 1
                                ? "text-red-600"
                                : daysUntilDue <= 3
                                ? "text-orange-600"
                                : "text-green-600"
                            }`}
                          />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {assignment.title}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {assignment.classes?.name || "No class"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-sm font-medium ${
                            daysUntilDue <= 1
                              ? "text-red-600"
                              : daysUntilDue <= 3
                              ? "text-orange-600"
                              : "text-green-600"
                          }`}
                        >
                          {daysUntilDue === 0
                            ? "Due today"
                            : daysUntilDue === 1
                            ? "Due tomorrow"
                            : `Due in ${daysUntilDue} days`}
                        </div>
                        <p className="text-xs text-gray-500">
                          {dueDate.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/dashboard/assignments/create"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Create Assignment</h3>
              <p className="text-sm text-gray-600">
                Give your students new work
              </p>
            </div>
          </Link>

          <Link
            href="/dashboard/assignments?filter=pending"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Grade Submissions</h3>
              <p className="text-sm text-gray-600">
                Review and grade student work
              </p>
            </div>
          </Link>

          <Link
            href="/dashboard/classes"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Manage Classes</h3>
              <p className="text-sm text-gray-600">
                View and organize your classes
              </p>
            </div>
          </Link>

          <Link
            href="/dashboard/students"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">View Students</h3>
              <p className="text-sm text-gray-600">Monitor student progress</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          Today's Schedule
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  Period 1 - World History
                </h3>
                <p className="text-sm text-gray-600">
                  8:00 AM - 8:45 AM • Room 205
                </p>
              </div>
            </div>
            <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
              Now
            </span>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  Period 2 - Algebra I
                </h3>
                <p className="text-sm text-gray-600">
                  9:00 AM - 9:45 AM • Room 205
                </p>
              </div>
            </div>
            <span className="text-sm text-gray-500">Next</span>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  Period 3 - English III
                </h3>
                <p className="text-sm text-gray-600">
                  11:00 AM - 11:45 AM • Room 205
                </p>
              </div>
            </div>
            <span className="text-sm text-gray-500">Later</span>
          </div>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-blue-900">
            Teacher Tools Coming Soon
          </h3>
        </div>
        <p className="text-blue-800 mb-4">
          We're building powerful teaching tools! The data shown above
          demonstrates the dashboard design with realistic preview content.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-blue-700">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>Assignment creation with rich content</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>Class and student management</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>Grading and feedback tools</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span>Student progress analytics</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>Due date and deadline management</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Real-time submission tracking</span>
          </div>
        </div>
      </div>

    </div>
  );
}
