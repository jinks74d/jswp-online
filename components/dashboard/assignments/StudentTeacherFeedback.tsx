// components/dashboard/assignments/StudentTeacherFeedback.tsx
"use client";

import { useState, useEffect } from "react";
import { MessageSquare, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";

interface StudentTeacherFeedbackProps {
  assignmentId: string;
  studentId: string;
}

interface StudentProgress {
  id: string;
  teacher_feedback?: Record<string, string>;
  updated_at: string;
}

export default function StudentTeacherFeedback({
  assignmentId,
  studentId,
}: StudentTeacherFeedbackProps) {
  const [feedback, setFeedback] = useState<StudentProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const supabase = createClient();
        
        const { data: progressData, error } = await supabase
          .from("student_assignment_progress")
          .select("id, teacher_feedback, updated_at")
          .eq("assignment_id", assignmentId)
          .eq("student_id", studentId)
          .single();

        if (error) {
          console.error("Error fetching feedback:", error);
          setFeedback(null);
        } else {
          setFeedback(progressData);
        }
      } catch (error) {
        console.error("Error fetching feedback:", error);
        setFeedback(null);
      } finally {
        setLoading(false);
      }
    };

    fetchFeedback();
  }, [assignmentId, studentId]);

  if (loading) {
    return (
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Teacher Feedback
        </h3>
        <div className="text-center py-8">
          <p className="text-gray-500">Loading feedback...</p>
        </div>
      </div>
    );
  }

  const hasFeedback = feedback?.teacher_feedback && Object.keys(feedback.teacher_feedback).length > 0;

  if (!hasFeedback) {
    return (
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Teacher Feedback
        </h3>
        <div className="text-center py-8">
          <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No teacher feedback yet</p>
          <p className="text-sm text-gray-400">
            Your teacher will provide feedback as you complete assignment steps
          </p>
        </div>
      </div>
    );
  }

  const getStepTitle = (stepKey: string) => {
    const stepTitles: Record<string, string> = {
      step1: "Step 1: Gathering Concrete Details",
      step2: "Step 2: Commentary Generation", 
      step3: "Step 3: Decision Making",
      step4: "Step 4: Elaboration",
      step5: "Step 5: First Draft",
      step6: "Step 6: Shaping Sheet",
      step7: "Step 7: Final Draft",
    };
    return stepTitles[stepKey] || stepKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  return (
    <div className="mt-8 pt-6 border-t border-gray-200">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Teacher Feedback</h3>
          <p className="text-sm text-gray-600">
            Feedback from your teacher on {Object.keys(feedback.teacher_feedback || {}).length} step{Object.keys(feedback.teacher_feedback || {}).length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {Object.entries(feedback.teacher_feedback || {}).map(([stepKey, feedbackText]) => (
          <div
            key={stepKey}
            className="bg-orange-50 border border-orange-200 rounded-lg p-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <MessageSquare className="w-4 h-4 text-orange-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-orange-900 mb-2">
                  {getStepTitle(stepKey)}
                </h4>
                <p className="text-orange-800 text-sm leading-relaxed whitespace-pre-wrap">
                  {feedbackText}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-orange-200">
        <p className="text-xs text-gray-500">
          Last updated: {new Date(feedback.updated_at).toLocaleDateString()} at{" "}
          {new Date(feedback.updated_at).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
