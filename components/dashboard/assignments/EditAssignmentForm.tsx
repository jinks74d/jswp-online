// components/dashboard/assignments/EditAssignmentForm.tsx
"use client";

import { useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
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

interface ClassPeriod {
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
}

interface EditAssignmentFormProps {
  assignment: Assignment;
  currentUserRole: UserRole;
  currentUserSchool?: { id: string; name: string } | null;
  districtName: string;
  districtId: string;
  teacherClasses: ClassPeriod[];
  userId: string;
}

export default function EditAssignmentForm({
  assignment,
  currentUserRole,
  currentUserSchool,
  districtName,
  districtId,
  teacherClasses,
  userId,
}: EditAssignmentFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    assignmentName: assignment.title,
    description: assignment.description,
    course: "", // We'll need to determine this from the assignment
    dueDate: assignment.due_date,
    prompt: "", // This field might not exist in the current assignment
  });

  const [saving, setSaving] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const supabase = createClient();

      // Create the updated assignment object
      const assignmentData = {
        title: formData.assignmentName,
        description: formData.description,
        due_date: formData.dueDate,
        // Don't update teacher_id, district_id, or school_id as these shouldn't change
      };

      console.log("Updating assignment:", assignmentData);

      // Update the assignment in the database
      const { data, error } = await supabase
        .from("assignments")
        .update(assignmentData)
        .eq("id", assignment.id)
        .select();

      console.log("Update response:", { data, error });

      if (error) {
        console.error("Error updating assignment:", error);
        alert(`Error updating assignment: ${error.message}`);
        setSaving(false);
        return;
      }

      console.log("Assignment updated successfully:", data);

      setSaving(false);

      // Navigate back to assignment detail page after saving
      router.push(`/dashboard/assignments/${assignment.id}`);
    } catch (error: any) {
      console.error("Error updating assignment:", error);
      alert(`Error updating assignment: ${error?.message || 'Unknown error'}`);
      setSaving(false);
    }
  };

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
        <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
          <Printer className="w-5 h-5" />
        </button>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Edit Assignment</h1>
        <p className="text-gray-600 mt-1">Update assignment details and settings</p>
      </div>

      {/* Main Form */}
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

        {/* Form Fields */}
        <div className="space-y-8">
          {/* Assignment Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assignment Name
            </label>
            <input
              type="text"
              value={formData.assignmentName}
              onChange={(e) =>
                handleInputChange("assignmentName", e.target.value)
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b3172c] focus:border-[#b3172c] text-gray-900"
              placeholder="Enter assignment name"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description of Assignment
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b3172c] focus:border-[#b3172c] text-gray-900"
              placeholder="Enter assignment description"
            />
          </div>

          {/* Course */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Course
            </label>
            <select
              value={formData.course}
              onChange={(e) => handleInputChange("course", e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b3172c] focus:border-[#b3172c] text-gray-900"
            >
              <option value="">Select a course</option>
              {teacherClasses.map((classPeriod) => (
                <option key={classPeriod.id} value={classPeriod.id}>
                  {classPeriod.classes.name} - Period {classPeriod.period}
                </option>
              ))}
            </select>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due Date
            </label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => handleInputChange("dueDate", e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b3172c] focus:border-[#b3172c] text-gray-900"
            />
          </div>

          {/* Enter Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter Prompt
            </label>
            <input
              type="text"
              value={formData.prompt}
              onChange={(e) => handleInputChange("prompt", e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b3172c] focus:border-[#b3172c] text-gray-900"
              placeholder="Enter the writing prompt"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-12">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <Link
            href={`/dashboard/assignments/${assignment.id}`}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Cancel
          </Link>
        </div>
      </div>

      {/* Assignment Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-4xl mx-auto">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Edit Assignment
          </h3>
          <p className="text-blue-800 mb-4">
            Update the assignment details. Changes will be saved immediately and reflected for all students.
          </p>
          <div className="text-sm text-blue-700">
            <p><strong>Note:</strong> Some fields like course assignment may require additional implementation for full functionality.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
