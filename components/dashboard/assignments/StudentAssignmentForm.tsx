// components/dashboard/assignments/StudentAssignmentForm.tsx
"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Clock, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserProfile } from "@/lib/supabase";
import GatheringCdsForm from "./GatheringCdsForm";
import CommentaryGenerationForm from "./CommentaryGenerationForm";

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  created_at: string;
  teacher_id: string;
  prompt?: string;
  user_profiles?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  class_periods?: {
    id: string;
    period: string;
    classes: {
      id: string;
      name: string;
      subjects: {
        id: string;
        name: string;
      };
    };
  } | null;
}

interface StudentAssignmentFormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

export default function StudentAssignmentForm({
  assignment,
  studentProfile,
}: StudentAssignmentFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    workingOn: "", // What are you working on today
    paragraphName: "", // Name Your Body Paragraph, Introduction, or Conclusion
    selectedChunks: 1, // Select one or two chunks
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validate that all required fields are present
      if (!formData.workingOn) {
        alert("Please select what you are working on today before saving.");
        setSaving(false);
        return;
      }

      // CRITICAL: This data structure ensures each student's answers are isolated
      // The combination of assignment_id + student_id creates a unique record per student
      const progressData = {
        assignment_id: assignment.id,
        student_id: studentProfile.id,
        working_on: formData.workingOn,
        paragraph_name: formData.paragraphName,
        selected_chunks: formData.selectedChunks,
        notes: formData.notes,
        status: "in_progress",
      };

      console.log("Saving student-specific progress:", progressData);
      console.log(`This data belongs ONLY to student: ${studentProfile.first_name} ${studentProfile.last_name} (ID: ${studentProfile.id})`);

      // Call the API to save to database
      const response = await fetch('/api/student-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progressData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save progress');
      }

      // Show success message with saved data
      const savedFields = [
        `Student: ${studentProfile.first_name} ${studentProfile.last_name}`,
        `Assignment: ${assignment.title}`,
        progressData.working_on && `Working on: ${progressData.working_on}`,
        progressData.paragraph_name && `Paragraph name: ${progressData.paragraph_name}`,
        `Chunks selected: ${progressData.selected_chunks}`,
        progressData.notes && `Notes: ${progressData.notes}`,
      ].filter(Boolean);

      alert(`✅ Progress saved to database!\n\nThis data is saved ONLY for this student:\n${savedFields.join('\n')}`);
      
    } catch (error) {
      console.error("Error saving progress:", error);
      alert(`❌ Error saving progress: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getDaysUntilDue = () => {
    const dueDate = new Date(assignment.due_date);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntilDue = getDaysUntilDue();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/assignments/${assignment.id}`}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Assignment
          </Link>
        </div>

        {/* Due Date Indicator */}
        <div
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            daysUntilDue <= 1
              ? "bg-red-100 text-red-800"
              : daysUntilDue <= 3
              ? "bg-orange-100 text-orange-800"
              : "bg-green-100 text-green-800"
          }`}
        >
          {daysUntilDue === 0
            ? "Due Today"
            : daysUntilDue === 1
            ? "Due Tomorrow"
            : `Due in ${daysUntilDue} days`}
        </div>
      </div>

      {/* Assignment Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-4">
          <img
            src="/assets/literary01-circle-cmyk.jpg"
            alt="Literary"
            className="w-12 h-12 rounded-full object-cover"
          />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {assignment.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                <span>
                  {assignment.user_profiles
                    ? `${assignment.user_profiles.first_name} ${assignment.user_profiles.last_name}`
                    : "Teacher"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>Due {formatDate(assignment.due_date)}</span>
              </div>
            </div>
          </div>
        </div>

        {assignment.description && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">
              Assignment Instructions
            </h3>
            <p className="text-gray-700">{assignment.description}</p>
          </div>
        )}
      </div>

      {/* Main Form - Same structure as teacher's form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
        {/* Literary Header with Icon */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/literary01-circle-cmyk.jpg"
            alt="Literary"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            RESPONSE TO LITERATURE
          </h2>
        </div>

        {/* Form Fields - Same structure as teacher's form but for student completion */}
        <div className="space-y-8">
          {/* Assignment Name - Read Only */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assignment Name
            </label>
            <div className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900">
              {assignment.title}
            </div>
          </div>

          {/* Description - Read Only */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assignment Description
            </label>
            <div className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 min-h-[80px]">
              {assignment.description || "No description provided"}
            </div>
          </div>

          {/* Course - Read Only */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Course
            </label>
            <div className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900">
              {assignment.class_periods
                ? `${assignment.class_periods.classes.name} - Period ${assignment.class_periods.period}`
                : "Literary Assignment"}
            </div>
          </div>

          {/* Due Date - Read Only */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due Date
            </label>
            <div className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900">
              {formatDate(assignment.due_date)}
            </div>
          </div>

          {/* Prompt - Read Only */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Writing Prompt
            </label>
            <div className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900">
              {assignment.prompt || "No prompt provided"}
            </div>
          </div>

          {/* What are you working on today? */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">
              What are you working on today?
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  handleInputChange("workingOn", "New Body Paragraph")
                }
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  formData.workingOn === "New Body Paragraph"
                    ? "bg-[#23366e] text-white border-[#23366e]"
                    : "bg-[#4a6fa5] text-white border-[#4a6fa5] hover:bg-[#3a5a8a]"
                }`}
              >
                New Body Paragraph
              </button>
              <button
                type="button"
                onClick={() => handleInputChange("workingOn", "Introduction")}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  formData.workingOn === "Introduction"
                    ? "bg-[#23366e] text-white border-[#23366e]"
                    : "bg-[#4a6fa5] text-white border-[#4a6fa5] hover:bg-[#3a5a8a]"
                }`}
              >
                Introduction
              </button>
              <button
                type="button"
                onClick={() => handleInputChange("workingOn", "Conclusion")}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  formData.workingOn === "Conclusion"
                    ? "bg-[#23366e] text-white border-[#23366e]"
                    : "bg-[#4a6fa5] text-white border-[#4a6fa5] hover:bg-[#3a5a8a]"
                }`}
              >
                Conclusion
              </button>
            </div>
          </div>

          {/* Name Your Body Paragraph */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name Your Body Paragraph, Introduction, or Conclusion
            </label>
            <input
              type="text"
              value={formData.paragraphName}
              onChange={(e) =>
                handleInputChange("paragraphName", e.target.value)
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b3172c] focus:border-[#b3172c] text-gray-900"
              placeholder="Enter a name for your body paragraph..."
            />
          </div>

          {/* Select one or two chunks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Select one or two chunks
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, selectedChunks: 1 }))
                }
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  formData.selectedChunks === 1
                    ? "bg-[#23366e] text-white border-[#23366e]"
                    : "bg-[#4a6fa5] text-white border-[#4a6fa5] hover:bg-[#3a5a8a]"
                }`}
              >
                One
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, selectedChunks: 2 }))
                }
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  formData.selectedChunks === 2
                    ? "bg-[#23366e] text-white border-[#23366e]"
                    : "bg-[#4a6fa5] text-white border-[#4a6fa5] hover:bg-[#3a5a8a]"
                }`}
              >
                Two
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-12">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-[#13161f] text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : "Save"}
          </button>

          <button
            onClick={async () => {
              await handleSave();
              if (!saving) {
                router.push(`/dashboard/assignments/${assignment.id}/gathering-cds`);
              }
            }}
            disabled={saving || !formData.workingOn.trim()}
            className="px-6 py-3 bg-[#3f8b31] text-white rounded-lg hover:bg-[#2d6625] disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : "Save and Continue"}
          </button>
        </div>
      </div>

      {/* Assignment Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Assignment Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-[#23366e]">In Progress</div>
            <div className="text-sm text-[#23366e]">Current Status</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-[#3f8b31]">
              {formData.workingOn ? "25%" : "0%"}
            </div>
            <div className="text-sm text-[#3f8b31]">Estimated Progress</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-[#b3172c]">
              {daysUntilDue}
            </div>
            <div className="text-sm text-[#b3172c]">Days Remaining</div>
          </div>
        </div>
      </div>
    </div>
  );
}
