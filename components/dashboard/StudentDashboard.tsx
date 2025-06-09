// components/dashboard/StudentDashboard.tsx
"use client";

import { FileText, GraduationCap, Users, BookOpen, Calendar, Clock } from "lucide-react";
import Link from "next/link";
import { UserProfile } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  class_periods?: {
    period: string;
    classes?: {
      name: string;
      subjects?: {
        name: string;
      };
    };
  };
  user_profiles?: {
    first_name: string;
    last_name: string;
  };
}

interface StudentDashboardProps {
  profile: UserProfile & {
    districts?: { id: string; name: string; domain: string | null };
    schools?: { id: string; name: string };
  };
}

export default function StudentDashboard({ profile }: StudentDashboardProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        // TEMPORARY: Until class_period_id is added to assignments table,
        // show assignments from the same school for students
        console.log('Fetching assignments for student dashboard in school:', profile.school_id);
        
        const { data: studentAssignments, error } = await supabase
          .from('assignments')
          .select(`
            *,
            user_profiles!assignments_teacher_id_fkey(
              first_name,
              last_name
            )
          `)
          .eq('school_id', profile.school_id)
          .order('due_date', { ascending: true });

        console.log('Assignments found for student dashboard:', studentAssignments?.length || 0);
        if (error) {
          console.error('Error fetching student assignments:', error);
          setAssignments([]);
        } else {
          setAssignments(studentAssignments || []);
        }
      } catch (error) {
        console.error('Error fetching student data:', error);
        setAssignments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [profile.id, profile.school_id, supabase]);

  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getUpcomingAssignments = () => {
    const today = new Date();
    return assignments
      .filter(assignment => new Date(assignment.due_date) >= today)
      .slice(0, 3);
  };

  const getAssignmentStats = () => {
    const today = new Date();
    const thisWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return {
      total: assignments.length,
      dueThisWeek: assignments.filter(a => {
        const dueDate = new Date(a.due_date);
        return dueDate >= today && dueDate <= thisWeek;
      }).length,
      overdue: assignments.filter(a => new Date(a.due_date) < today).length,
    };
  };

  const stats = getAssignmentStats();
  const upcomingAssignments = getUpcomingAssignments();
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Student Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Welcome back, {profile.first_name}! Let's get learning!
        </p>
        {profile.schools?.name && (
          <p className="text-sm text-gray-500 mt-1">
            {profile.schools.name} • {profile.districts?.name}
          </p>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Assignments</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? "..." : stats.total}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            {loading ? "Loading..." : `${stats.dueThisWeek} due this week`}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Classes</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? "..." : "4"}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Active this semester</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? "..." : stats.overdue}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Need attention</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/dashboard/assignments"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">View Assignments</h3>
              <p className="text-sm text-gray-600">Check your homework and projects</p>
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
              <h3 className="font-medium text-gray-900">My Classes</h3>
              <p className="text-sm text-gray-600">View class schedules and materials</p>
            </div>
          </Link>

          <Link
            href="/dashboard/grades"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">My Grades</h3>
              <p className="text-sm text-gray-600">View grades and feedback</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming Assignments */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Assignments</h2>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading assignments...</p>
              </div>
            ) : upcomingAssignments.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No upcoming assignments</p>
                <p className="text-sm text-gray-400">You&apos;re all caught up!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingAssignments.map((assignment) => {
                  const daysUntilDue = getDaysUntilDue(assignment.due_date);
                  const getStatusColor = () => {
                    if (daysUntilDue <= 1) return "bg-red-100 text-red-600";
                    if (daysUntilDue <= 3) return "bg-orange-100 text-orange-600";
                    return "bg-green-100 text-green-600";
                  };
                  const getStatusText = () => {
                    if (daysUntilDue === 0) return "Due Today";
                    if (daysUntilDue === 1) return "Due Tomorrow";
                    return `Due in ${daysUntilDue} days`;
                  };

                  return (
                    <Link
                      key={assignment.id}
                      href={`/dashboard/assignments/${assignment.id}`}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getStatusColor()}`}>
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{assignment.title}</h3>
                          <p className="text-sm text-gray-600">
                            {assignment.user_profiles ? 
                              `${assignment.user_profiles.first_name} ${assignment.user_profiles.last_name}` : 
                              'Teacher'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${daysUntilDue <= 1 ? 'text-red-600' : daysUntilDue <= 3 ? 'text-orange-600' : 'text-green-600'}`}>
                          {getStatusText()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(assignment.due_date).toLocaleDateString()}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Grades and Feedback */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Grades & Feedback</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <GraduationCap className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Math Quiz - Chapter 4</h3>
                    <p className="text-sm text-gray-600">Great work on problem solving!</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-green-600">A-</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Science Lab Report</h3>
                    <p className="text-sm text-gray-600">Excellent observations and analysis</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-blue-600">B+</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">History Essay</h3>
                    <p className="text-sm text-gray-600">Good research, work on conclusion</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-purple-600">B</span>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <Link
                href="/dashboard/grades"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View all grades and feedback →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-blue-900">Student Features Coming Soon</h3>
        </div>
        <p className="text-blue-800 mb-4">
          We're building amazing tools for students! The data shown above demonstrates the dashboard design with realistic preview content.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-blue-700">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>Assignment submission and tracking</span>
          </div>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            <span>Grade viewing and progress reports</span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            <span>Class materials and resources</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>Schedule and calendar integration</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>Teacher communication tools</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Real-time assignment notifications</span>
          </div>
        </div>
      </div>
    </div>
  );
}
