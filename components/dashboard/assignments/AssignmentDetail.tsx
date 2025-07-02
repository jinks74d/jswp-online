// components/dashboard/assignments/AssignmentDetail.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  User,
  Building,
  FileText,
  Play,
  RotateCcw,
  Eye,
  X,
  MessageSquare,
  Save,
  Printer,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useReactToPrint } from "react-to-print";
import { UserRole, createClient } from "@/lib/supabase";
import StudentTeacherFeedback from "./StudentTeacherFeedback";
import PrintableAssignment from "./PrintableAssignment";

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  created_at: string;
  teacher_id: string;
  district_id: string;
  school_id: string;
  prompt?: string;
}

interface StudentProgress {
  id?: string;
  student_id?: string;
  assignment_id?: string;
  concrete_details: string;
  status: string;
  working_on?: string;
  created_at?: string;
  updated_at?: string;
  teacher_feedback?: Record<string, string>;
}

interface StudentWithProgress {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  progress_data: StudentProgress | null;
  hasSubmitted: boolean;
  hasProgress: boolean;
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
  const [stats, setStats] = useState({
    totalStudents: 0,
    submissions: 0,
    pending: 0,
    graded: 0,
  });
  const [studentProgress, setStudentProgress] = useState<{
    status: string;
    progress: number;
    hasStarted: boolean;
    currentStep: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentWithProgress[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<StudentProgress | null>(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  
  // Feedback state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [currentFeedbackStep, setCurrentFeedbackStep] = useState<string>("");
  const [feedbackText, setFeedbackText] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);

  const printableComponentRef = useRef<HTMLDivElement>(null);

  const canEdit = assignment.teacher_id === currentUserId;
  const canDelete = assignment.teacher_id === currentUserId;

  // Fetch assignment statistics and student progress
  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient();

        if (currentUserRole === "student") {
          // Fetch student's progress for this assignment
          const { data: progressData } = await supabase
            .from("student_assignment_progress")
            .select("*")
            .eq("assignment_id", assignment.id)
            .eq("student_id", currentUserId)
            .single();

          if (progressData) {
            // Calculate progress percentage based on status and working_on
            let progressPercentage = 0;
            const status = progressData.status || "not_started";

            if (status === "submitted") {
              progressPercentage = 100;
            } else if (progressData.working_on) {
              // Calculate progress based on current step
              const stepProgress: Record<string, number> = {
                gathering_cds: 14,
                step_1: 14,
                commentary_generation: 28,
                step_2: 28,
                decisions: 42,
                step_3: 42,
                elaboration: 56,
                step_4: 56,
                writing_first_draft: 70,
                step_5: 70,
                shaping_sheet: 84,
                step_6: 84,
                final_draft: 98,
                step_7: 98,
                completed: 100,
              };
              progressPercentage = stepProgress[progressData.working_on] || 0;
            }

            setStudentProgress({
              status: status,
              progress: progressPercentage,
              hasStarted: progressData.working_on !== null,
              currentStep: progressData.working_on || "gathering_cds",
            });
          } else {
            // No progress record found - assignment not started
            setStudentProgress({
              status: "not_started",
              progress: 0,
              hasStarted: false,
              currentStep: "gathering_cds",
            });
          }
        } else {
          // Fetch teacher/admin statistics and student list
          // Get all students in the school
          const { data: allStudents } = await supabase
            .from("user_profiles")
            .select("id, first_name, last_name, email")
            .eq("role", "student")
            .eq("school_id", assignment.school_id);

          // Get submission data for all students
          const { data: progressData } = await supabase
            .from("student_assignment_progress")
            .select("*")
            .eq("assignment_id", assignment.id);

          // Combine student data with their progress
          const studentsWithProgress = (allStudents || []).map((student) => {
            const progress = progressData?.find(
              (p) => p.student_id === student.id
            );
            const status = progress?.status || "not_started";

            return {
              ...student,
              status: status,
              progress_data: progress,
              hasSubmitted: status === "submitted",
              hasProgress: !!progress && progress.concrete_details,
            };
          });

          setStudents(studentsWithProgress);

          const submissions = progressData?.length || 0;
          const pending =
            progressData?.filter((p) => p.status === "completed").length || 0;
          const graded =
            progressData?.filter((p) => p.status === "graded").length || 0;

          setStats({
            totalStudents: allStudents?.length || 0,
            submissions,
            pending,
            graded,
          });
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [assignment.id, assignment.school_id, currentUserRole, currentUserId]);

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
    } catch (err: unknown) {
      console.error("Error deleting assignment:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      alert(`Error deleting assignment: ${errorMessage}`);
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

  // Feedback functions
  const handleAddFeedback = (stepKey: string) => {
    setCurrentFeedbackStep(stepKey);
    setFeedbackText(selectedSubmission?.teacher_feedback?.[stepKey] || "");
    setShowFeedbackModal(true);
  };

  const handleSaveFeedback = async () => {
    if (!selectedSubmission?.id || !currentFeedbackStep) return;

    setSavingFeedback(true);
    try {
      const response = await fetch("/api/teacher-feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          progressId: selectedSubmission.id,
          stepKey: currentFeedbackStep,
          feedback: feedbackText,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save feedback");
      }

      await response.json();
      
      // Update the selected submission with new feedback
      setSelectedSubmission(prev => ({
        ...prev!,
        teacher_feedback: {
          ...prev?.teacher_feedback,
          [currentFeedbackStep]: feedbackText,
        },
      }));

      // Close modal and reset state
      setShowFeedbackModal(false);
      setCurrentFeedbackStep("");
      setFeedbackText("");
      
      alert("Feedback saved successfully!");
    } catch (error) {
      console.error("Error saving feedback:", error);
      alert("Failed to save feedback. Please try again.");
    } finally {
      setSavingFeedback(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printableComponentRef,
    documentTitle: assignment.title,
    pageStyle: `
      @page {
        size: 8.5in 11in;
        margin: 1in;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `,
  });

  const getStudentWorkForPrint = () => {
    if (selectedSubmission?.concrete_details) {
      try {
        const details = JSON.parse(selectedSubmission.concrete_details);
        if (details.step7?.finalParagraph) {
          return details.step7.finalParagraph;
        }
        if (typeof details.step7 === 'string') {
          return details.step7;
        }
      } catch {
        // Not JSON, return as is
        return selectedSubmission.concrete_details;
      }
    }
    return "No final draft submitted.";
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
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Assignment
          </button>

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
        <p className="text-gray-600 mt-1">
          View assignment details and manage settings
        </p>
      </div>

      {/* Assignment Details */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        {/* Assignment Header */}
        <div className="border-b border-gray-200 pb-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {assignment.title}
          </h2>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Assignment Details
              </h3>
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
                  <p className="text-gray-900">
                    {formatDate(assignment.due_date)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Writing Prompt
                  </label>
                  <p className="text-gray-900">
                    {assignment.prompt || "No prompt provided"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Assignment Info
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assignment Type
                  </label>
                  <p className="text-gray-900">
                    Literary - Response to Literature
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    School
                  </label>
                  <p className="text-gray-900">
                    {currentUserSchool?.name || "Unknown School"}
                  </p>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Assignment Statistics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-600">
                      Total Students
                    </p>
                    <p className="text-xl font-bold text-blue-900">
                      {loading ? "..." : stats.totalStudents}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-600">
                      Submissions
                    </p>
                    <p className="text-xl font-bold text-green-900">
                      {loading ? "..." : stats.submissions}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-orange-600">
                      Pending
                    </p>
                    <p className="text-xl font-bold text-orange-900">
                      {loading ? "..." : stats.pending}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Building className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-purple-600">
                      Graded
                    </p>
                    <p className="text-xl font-bold text-purple-900">
                      {loading ? "..." : stats.graded}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Student List Section for Teachers */}
        {currentUserRole !== "student" && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Student Submissions
            </h3>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading students...</p>
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-8">
                <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No students found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {student.first_name} {student.last_name}
                        </h4>
                        <p className="text-sm text-gray-600">{student.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          student.status === "submitted"
                            ? "bg-green-100 text-green-800"
                            : student.status === "in_progress"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {student.status === "submitted"
                          ? "Submitted"
                          : student.status === "in_progress"
                          ? "In Progress"
                          : "Not Started"}
                      </span>
                      {student.hasSubmitted ? (
                        <button
                          onClick={() => {
                            setSelectedSubmission(student.progress_data);
                            setShowSubmissionModal(true);
                          }}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View Submission
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedSubmission(
                              student.progress_data || {
                                concrete_details: "{}",
                                status: "not_started",
                              }
                            );
                            setShowSubmissionModal(true);
                          }}
                          className="flex items-center gap-1 px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View Work
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Student Progress Section */}
        {currentUserRole === "student" && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Your Progress
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Play className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-600">Status</p>
                    <p className="text-xl font-bold text-blue-900">
                      {loading
                        ? "..."
                        : studentProgress?.status === "submitted"
                        ? "Submitted"
                        : studentProgress?.status === "completed"
                        ? "Completed"
                        : studentProgress?.hasStarted
                        ? "In Progress"
                        : "Not Started"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-600">
                      Progress
                    </p>
                    <p className="text-xl font-bold text-green-900">
                      {loading ? "..." : `${studentProgress?.progress || 0}%`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-orange-600">
                      Time Remaining
                    </p>
                    <p className="text-xl font-bold text-orange-900">
                      {Math.ceil(
                        (new Date(assignment.due_date).getTime() -
                          new Date().getTime()) /
                          (1000 * 60 * 60 * 24)
                      )}{" "}
                      days
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Student Teacher Feedback Section */}
        {currentUserRole === "student" && (
          <StudentTeacherFeedback 
            assignmentId={assignment.id}
            studentId={currentUserId}
          />
        )}
      </div>

      {/* Submission Modal */}
      {showSubmissionModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Student Work Review
              </h3>
              <button
                onClick={() => {
                  setShowSubmissionModal(false);
                  setSelectedSubmission(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {selectedSubmission?.concrete_details ? (
                <div className="space-y-6">
                  {(() => {
                    try {
                      const details = JSON.parse(
                        selectedSubmission.concrete_details
                      );

                      // Display all available steps
                      const sections = [];

                      // Step 1: Gathering CDs
                      if (
                        details.step1 ||
                        details.chunk1CDs ||
                        details.chunk2CDs
                      ) {
                        sections.push(
                          <div
                            key="step1"
                            className="border border-gray-200 rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-gray-900">
                                Step 1: Gathering Concrete Details
                              </h4>
                              {currentUserRole !== "student" && (
                                <button
                                  onClick={() => handleAddFeedback("step1")}
                                  className="flex items-center gap-1 px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                  Add Feedback
                                </button>
                              )}
                            </div>

                            {details.chunk1CDs &&
                              Array.isArray(details.chunk1CDs) && (
                                <div className="mb-4">
                                  <h5 className="font-medium text-gray-800 mb-2">
                                    Chunk 1 - Concrete Details
                                  </h5>
                                  {details.chunk1CDs.map(
                                    (cd: string, index: number) => (
                                      <div
                                        key={index}
                                        className="bg-red-50 p-3 rounded mb-2"
                                      >
                                        <p className="text-sm font-medium text-red-900 mb-1">
                                          CD {index + 1}:
                                        </p>
                                        <p className="text-red-800">{cd}</p>
                                      </div>
                                    )
                                  )}
                                </div>
                              )}

                            {details.chunk2CDs &&
                              Array.isArray(details.chunk2CDs) && (
                                <div>
                                  <h5 className="font-medium text-gray-800 mb-2">
                                    Chunk 2 - Concrete Details
                                  </h5>
                                  {details.chunk2CDs.map(
                                    (cd: string, index: number) => (
                                      <div
                                        key={index}
                                        className="bg-red-50 p-3 rounded mb-2"
                                      >
                                        <p className="text-sm font-medium text-red-900 mb-1">
                                          CD {index + 1}:
                                        </p>
                                        <p className="text-red-800">{cd}</p>
                                      </div>
                                    )
                                  )}
                                </div>
                              )}

                            {/* Display feedback if exists */}
                            {selectedSubmission?.teacher_feedback?.step1 && (
                              <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
                                <div className="flex items-start gap-2">
                                  <MessageSquare className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <h6 className="font-medium text-orange-900 mb-1">
                                      Teacher Feedback:
                                    </h6>
                                    <p className="text-orange-800 text-sm leading-relaxed">
                                      {selectedSubmission.teacher_feedback.step1}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // Step 2: Commentary Generation
                      if (
                        details.step2 ||
                        details.chunk1Words ||
                        details.chunk2Words ||
                        details.commentaryWords ||
                        details.chunk1CommentaryWords ||
                        details.chunk2CommentaryWords
                      ) {
                        sections.push(
                          <div
                            key="step2"
                            className="border border-gray-200 rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-gray-900">
                                Step 2: Commentary Generation
                              </h4>
                              {currentUserRole !== "student" && (
                                <button
                                  onClick={() => handleAddFeedback("step2")}
                                  className="flex items-center gap-1 px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                  Add Feedback
                                </button>
                              )}
                            </div>

                            {/* Handle step2 object structure */}
                            {details.step2 && typeof details.step2 === "object" && (
                              <div className="space-y-3">
                                {details.step2.chunk1Words && Array.isArray(details.step2.chunk1Words) && (
                                  <div className="mb-4">
                                    <h5 className="font-medium text-gray-800 mb-2">
                                      Chunk 1 - Commentary Words
                                    </h5>
                                    <div className="bg-green-50 p-3 rounded">
                                      <p className="text-green-800">
                                        {details.step2.chunk1Words.join(", ")}
                                      </p>
                                    </div>
                                  </div>
                                )}
                                {details.step2.chunk2Words && Array.isArray(details.step2.chunk2Words) && (
                                  <div>
                                    <h5 className="font-medium text-gray-800 mb-2">
                                      Chunk 2 - Commentary Words
                                    </h5>
                                    <div className="bg-green-50 p-3 rounded">
                                      <p className="text-green-800">
                                        {details.step2.chunk2Words.join(", ")}
                                      </p>
                                    </div>
                                  </div>
                                )}
                                {/* Handle other step2 properties */}
                                {Object.keys(details.step2).map((key) => {
                                  if (key !== 'chunk1Words' && key !== 'chunk2Words' && details.step2[key]) {
                                    return (
                                      <div key={key} className="bg-green-50 p-3 rounded">
                                        <p className="text-sm font-medium text-green-900 mb-1">
                                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                                        </p>
                                        <p className="text-green-800">
                                          {Array.isArray(details.step2[key]) 
                                            ? details.step2[key].join(", ") 
                                            : details.step2[key]}
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                            )}

                            {/* Handle direct chunk words arrays */}
                            {details.chunk1Words &&
                              Array.isArray(details.chunk1Words) && (
                                <div className="mb-4">
                                  <h5 className="font-medium text-gray-800 mb-2">
                                    Chunk 1 - Commentary Words
                                  </h5>
                                  <div className="bg-green-50 p-3 rounded">
                                    <p className="text-green-800">
                                      {details.chunk1Words.join(", ")}
                                    </p>
                                  </div>
                                </div>
                              )}

                            {details.chunk2Words &&
                              Array.isArray(details.chunk2Words) && (
                                <div>
                                  <h5 className="font-medium text-gray-800 mb-2">
                                    Chunk 2 - Commentary Words
                                  </h5>
                                  <div className="bg-green-50 p-3 rounded">
                                    <p className="text-green-800">
                                      {details.chunk2Words.join(", ")}
                                    </p>
                                  </div>
                                </div>
                              )}

                            {/* Handle alternative naming conventions */}
                            {details.chunk1CommentaryWords &&
                              Array.isArray(details.chunk1CommentaryWords) && (
                                <div className="mb-4">
                                  <h5 className="font-medium text-gray-800 mb-2">
                                    Chunk 1 - Commentary Words
                                  </h5>
                                  <div className="bg-green-50 p-3 rounded">
                                    <p className="text-green-800">
                                      {details.chunk1CommentaryWords.join(", ")}
                                    </p>
                                  </div>
                                </div>
                              )}

                            {details.chunk2CommentaryWords &&
                              Array.isArray(details.chunk2CommentaryWords) && (
                                <div>
                                  <h5 className="font-medium text-gray-800 mb-2">
                                    Chunk 2 - Commentary Words
                                  </h5>
                                  <div className="bg-green-50 p-3 rounded">
                                    <p className="text-green-800">
                                      {details.chunk2CommentaryWords.join(", ")}
                                    </p>
                                  </div>
                                </div>
                              )}

                            {/* Handle general commentary words */}
                            {details.commentaryWords &&
                              Array.isArray(details.commentaryWords) && (
                                <div>
                                  <h5 className="font-medium text-gray-800 mb-2">
                                    Commentary Words
                                  </h5>
                                  <div className="bg-green-50 p-3 rounded">
                                    <p className="text-green-800">
                                      {details.commentaryWords.join(", ")}
                                    </p>
                                  </div>
                                </div>
                              )}

                            {/* Fallback for step2 as string */}
                            {details.step2 && typeof details.step2 === "string" && (
                              <div className="bg-green-50 p-3 rounded">
                                <p className="text-green-800 whitespace-pre-wrap">
                                  {details.step2}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // Step 3: Decision Making
                      if (details.step3) {
                        sections.push(
                          <div
                            key="step3"
                            className="border border-gray-200 rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-gray-900">
                                Step 3: Decision Making
                              </h4>
                              {currentUserRole !== "student" && (
                                <button
                                  onClick={() => handleAddFeedback("step3")}
                                  className="flex items-center gap-1 px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                  Add Feedback
                                </button>
                              )}
                            </div>
                            {details.step3.topicSentenceWord && (
                              <div className="bg-blue-50 p-3 rounded mb-3">
                                <p className="text-sm font-medium text-blue-900 mb-1">
                                  Topic Sentence Word:
                                </p>
                                <p className="text-blue-800 font-medium">
                                  {details.step3.topicSentenceWord}
                                </p>
                              </div>
                            )}
                            {details.step3.selectedCD1 && (
                              <div className="bg-red-50 p-3 rounded mb-3">
                                <p className="text-sm font-medium text-red-900 mb-1">
                                  Selected CD 1:
                                </p>
                                <p className="text-red-800">
                                  {details.step3.selectedCD1}
                                </p>
                              </div>
                            )}
                            {details.step3.selectedCD2 && (
                              <div className="bg-red-50 p-3 rounded">
                                <p className="text-sm font-medium text-red-900 mb-1">
                                  Selected CD 2:
                                </p>
                                <p className="text-red-800">
                                  {details.step3.selectedCD2}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // Step 4: Elaboration
                      if (details.step4) {
                        sections.push(
                          <div
                            key="step4"
                            className="border border-gray-200 rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-gray-900">
                                Step 4: Elaboration
                              </h4>
                              {currentUserRole !== "student" && (
                                <button
                                  onClick={() => handleAddFeedback("step4")}
                                  className="flex items-center gap-1 px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                  Add Feedback
                                </button>
                              )}
                            </div>
                            <div className="space-y-3">
                              {typeof details.step4 === "object" &&
                              details.step4 !== null ? (
                                <>
                                  {details.step4.topicSentence && (
                                    <div className="bg-blue-50 p-3 rounded">
                                      <p className="text-sm font-medium text-blue-900 mb-1">
                                        Topic Sentence:
                                      </p>
                                      <p className="text-blue-800">
                                        {details.step4.topicSentence}
                                      </p>
                                    </div>
                                  )}
                                  {details.step4.topicSentenceWord && (
                                    <div className="bg-blue-50 p-3 rounded">
                                      <p className="text-sm font-medium text-blue-900 mb-1">
                                        Topic Sentence Word:
                                      </p>
                                      <p className="text-blue-800">
                                        {details.step4.topicSentenceWord}
                                      </p>
                                    </div>
                                  )}
                                  {details.step4.chunk1CM1Synonym && (
                                    <div className="bg-green-50 p-3 rounded">
                                      <p className="text-sm font-medium text-green-900 mb-1">
                                        Chunk 1 Commentary:
                                      </p>
                                      <p className="text-green-800">
                                        {details.step4.chunk1CM1Synonym} -{" "}
                                        {details.step4.chunk1CM1Phrase1}
                                      </p>
                                    </div>
                                  )}
                                  {details.step4.chunk2CM1Synonym && (
                                    <div className="bg-green-50 p-3 rounded">
                                      <p className="text-sm font-medium text-green-900 mb-1">
                                        Chunk 2 Commentary:
                                      </p>
                                      <p className="text-green-800">
                                        {details.step4.chunk2CM1Synonym} -{" "}
                                        {details.step4.chunk2CM1Phrase1}
                                      </p>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="bg-yellow-50 p-3 rounded">
                                  <p className="text-gray-900">
                                    {details.step4}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // Step 5: First Draft
                      if (details.step5) {
                        sections.push(
                          <div
                            key="step5"
                            className="border border-gray-200 rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-gray-900">
                                Step 5: First Draft
                              </h4>
                              {currentUserRole !== "student" && (
                                <button
                                  onClick={() => handleAddFeedback("step5")}
                                  className="flex items-center gap-1 px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                  Add Feedback
                                </button>
                              )}
                            </div>
                            <div className="space-y-3">
                              {typeof details.step5 === "object" &&
                              details.step5 !== null ? (
                                <>
                                  {details.step5.chunk1CommentarySentence1 && (
                                    <div className="bg-green-50 p-3 rounded">
                                      <p className="text-sm font-medium text-green-900 mb-1">
                                        Chunk 1 Commentary Sentence 1:
                                      </p>
                                      <p className="text-green-800">
                                        {
                                          details.step5
                                            .chunk1CommentarySentence1
                                        }
                                      </p>
                                    </div>
                                  )}
                                  {details.step5.chunk1CommentarySentence2 && (
                                    <div className="bg-green-50 p-3 rounded">
                                      <p className="text-sm font-medium text-green-900 mb-1">
                                        Chunk 1 Commentary Sentence 2:
                                      </p>
                                      <p className="text-green-800">
                                        {
                                          details.step5
                                            .chunk1CommentarySentence2
                                        }
                                      </p>
                                    </div>
                                  )}
                                  {details.step5.chunk2CommentarySentence1 && (
                                    <div className="bg-green-50 p-3 rounded">
                                      <p className="text-sm font-medium text-green-900 mb-1">
                                        Chunk 2 Commentary Sentence 1:
                                      </p>
                                      <p className="text-green-800">
                                        {
                                          details.step5
                                            .chunk2CommentarySentence1
                                        }
                                      </p>
                                    </div>
                                  )}
                                  {details.step5.chunk2CommentarySentence2 && (
                                    <div className="bg-green-50 p-3 rounded">
                                      <p className="text-sm font-medium text-green-900 mb-1">
                                        Chunk 2 Commentary Sentence 2:
                                      </p>
                                      <p className="text-green-800">
                                        {
                                          details.step5
                                            .chunk2CommentarySentence2
                                        }
                                      </p>
                                    </div>
                                  )}
                                  {details.step5.concludingSentence && (
                                    <div className="bg-blue-50 p-3 rounded">
                                      <p className="text-sm font-medium text-blue-900 mb-1">
                                        Concluding Sentence:
                                      </p>
                                      <p className="text-blue-800">
                                        {details.step5.concludingSentence}
                                      </p>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="bg-purple-50 p-3 rounded">
                                  <p className="text-gray-900 whitespace-pre-wrap">
                                    {details.step5}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // Step 6: Shaping Sheet
                      if (details.step6) {
                        sections.push(
                          <div
                            key="step6"
                            className="border border-gray-200 rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-gray-900">
                                Step 6: Shaping Sheet
                              </h4>
                              {currentUserRole !== "student" && (
                                <button
                                  onClick={() => handleAddFeedback("step6")}
                                  className="flex items-center gap-1 px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                  Add Feedback
                                </button>
                              )}
                            </div>
                            <div className="space-y-3">
                              {typeof details.step6 === "object" &&
                              details.step6 !== null ? (
                                <>
                                  {details.step6.topicSentence && (
                                    <div className="bg-blue-50 p-3 rounded">
                                      <p className="text-sm font-medium text-blue-900 mb-1">
                                        Topic Sentence:
                                      </p>
                                      <p className="text-blue-800">
                                        {details.step6.topicSentence}
                                      </p>
                                    </div>
                                  )}
                                  {details.step6.chunk1CD && (
                                    <div className="bg-red-50 p-3 rounded">
                                      <p className="text-sm font-medium text-red-900 mb-1">
                                        Chunk 1 CD:
                                      </p>
                                      <p className="text-red-800">
                                        {details.step6.chunk1CD}
                                      </p>
                                    </div>
                                  )}
                                  {details.step6.chunk1CM1 && (
                                    <div className="bg-green-50 p-3 rounded">
                                      <p className="text-sm font-medium text-green-900 mb-1">
                                        Chunk 1 Commentary 1:
                                      </p>
                                      <p className="text-green-800">
                                        {details.step6.chunk1CM1}
                                      </p>
                                    </div>
                                  )}
                                  {details.step6.chunk1CM2 && (
                                    <div className="bg-green-50 p-3 rounded">
                                      <p className="text-sm font-medium text-green-900 mb-1">
                                        Chunk 1 Commentary 2:
                                      </p>
                                      <p className="text-green-800">
                                        {details.step6.chunk1CM2}
                                      </p>
                                    </div>
                                  )}
                                  {details.step6.chunk2CD && (
                                    <div className="bg-red-50 p-3 rounded">
                                      <p className="text-sm font-medium text-red-900 mb-1">
                                        Chunk 2 CD:
                                      </p>
                                      <p className="text-red-800">
                                        {details.step6.chunk2CD}
                                      </p>
                                    </div>
                                  )}
                                  {details.step6.chunk2CM1 && (
                                    <div className="bg-green-50 p-3 rounded">
                                      <p className="text-sm font-medium text-green-900 mb-1">
                                        Chunk 2 Commentary 1:
                                      </p>
                                      <p className="text-green-800">
                                        {details.step6.chunk2CM1}
                                      </p>
                                    </div>
                                  )}
                                  {details.step6.chunk2CM2 && (
                                    <div className="bg-green-50 p-3 rounded">
                                      <p className="text-sm font-medium text-green-900 mb-1">
                                        Chunk 2 Commentary 2:
                                      </p>
                                      <p className="text-green-800">
                                        {details.step6.chunk2CM2}
                                      </p>
                                    </div>
                                  )}
                                  {details.step6.concludingSentence && (
                                    <div className="bg-blue-50 p-3 rounded">
                                      <p className="text-sm font-medium text-blue-900 mb-1">
                                        Concluding Sentence:
                                      </p>
                                      <p className="text-blue-800">
                                        {details.step6.concludingSentence}
                                      </p>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="bg-indigo-50 p-3 rounded">
                                  <p className="text-gray-900">
                                    {details.step6}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // Step 7: Final Draft
                      if (details.step7) {
                        sections.push(
                          <div
                            key="step7"
                            className="border border-gray-200 rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-gray-900">
                                Step 7: Final Draft
                              </h4>
                              {currentUserRole !== "student" && (
                                <button
                                  onClick={() => handleAddFeedback("step7")}
                                  className="flex items-center gap-1 px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                  Add Feedback
                                </button>
                              )}
                            </div>
                            <div className="space-y-3">
                              {typeof details.step7 === "object" &&
                              details.step7 !== null ? (
                                <>
                                  {details.step7.paragraphTitle && (
                                    <div className="bg-gray-50 p-3 rounded">
                                      <p className="text-sm font-medium text-gray-700 mb-1">
                                        Paragraph Title:
                                      </p>
                                      <p className="text-gray-900 font-medium">
                                        {details.step7.paragraphTitle}
                                      </p>
                                    </div>
                                  )}
                                  {details.step7.finalParagraph && (
                                    <div className="bg-gray-50 p-3 rounded">
                                      <p className="text-sm font-medium text-gray-900 mb-2">
                                        Final Paragraph:
                                      </p>
                                      <p className="text-gray-800 leading-relaxed">
                                        {details.step7.finalParagraph}
                                      </p>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="bg-green-50 p-3 rounded">
                                  <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">
                                    {details.step7}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // Show progress status
                      if (
                        selectedSubmission.status ||
                        selectedSubmission.working_on
                      ) {
                        sections.unshift(
                          <div
                            key="status"
                            className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                          >
                            <h4 className="font-semibold text-gray-900 mb-3">
                              Student Progress
                            </h4>
                            <div className="flex gap-4">
                              {selectedSubmission.status && (
                                <div>
                                  <span className="text-sm font-medium text-gray-600">
                                    Status:{" "}
                                  </span>
                                  <span className="text-gray-900 font-medium capitalize">
                                    {selectedSubmission.status}
                                  </span>
                                </div>
                              )}
                              {selectedSubmission.working_on && (
                                <div>
                                  <span className="text-sm font-medium text-gray-600">
                                    Current Step:{" "}
                                  </span>
                                  <span className="text-gray-900 font-medium capitalize">
                                    {selectedSubmission.working_on.replace(
                                      /_/g,
                                      " "
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      if (sections.length > 0) {
                        return <div className="space-y-4">{sections}</div>;
                      }

                      // Fallback to show all data
                      return (
                        <div className="space-y-4">
                          <h4 className="font-semibold text-gray-900 mb-3">
                            Student Work
                          </h4>
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                              {JSON.stringify(details, null, 2)}
                            </pre>
                          </div>
                        </div>
                      );
                    } catch {
                      return (
                        <div className="space-y-4">
                          <h4 className="font-semibold text-gray-900 mb-3">
                            Raw Data
                          </h4>
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                              {selectedSubmission.concrete_details}
                            </pre>
                          </div>
                        </div>
                      );
                    }
                  })()}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No work submitted yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Add Feedback - {currentFeedbackStep.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </h3>
              <button
                onClick={() => {
                  setShowFeedbackModal(false);
                  setCurrentFeedbackStep("");
                  setFeedbackText("");
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Feedback for this step:
                </label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Enter your feedback for the student..."
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none text-gray-900 placeholder-gray-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowFeedbackModal(false);
                    setCurrentFeedbackStep("");
                    setFeedbackText("");
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveFeedback}
                  disabled={savingFeedback || !feedbackText.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {savingFeedback ? "Saving..." : "Save Feedback"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Future Features Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Assignment Management Features
          </h3>
          <p className="text-blue-800 mb-4">
            Additional assignment management features will be added here as the
            system develops.
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

      <div style={{ display: "none" }}>
        <PrintableAssignment
          ref={printableComponentRef}
          studentName={
            currentUserRole === 'student' 
              ? `${students.find(s => s.id === currentUserId)?.first_name || 'Student'} ${students.find(s => s.id === currentUserId)?.last_name || 'Name'}`
              : selectedSubmission 
                ? `${students.find(s => s.id === selectedSubmission.student_id)?.first_name || 'Student'} ${students.find(s => s.id === selectedSubmission.student_id)?.last_name || 'Name'}`
                : 'Student Name'
          }
          teacherName={
            students.length > 0 && assignment.teacher_id
              ? `${students.find(s => s.id === assignment.teacher_id)?.first_name || 'Teacher'} ${students.find(s => s.id === assignment.teacher_id)?.last_name || 'Name'}`
              : 'Teacher Name'
          }
          courseName={currentUserSchool?.name || "Class Name"}
          assignment={assignment}
          studentWork={getStudentWorkForPrint()}
        />
      </div>
    </div>
  );
}
