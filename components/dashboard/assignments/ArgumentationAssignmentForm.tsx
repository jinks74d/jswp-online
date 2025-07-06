// components/dashboard/assignments/ArgumentationAssignmentForm.tsx
"use client";

import { useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRole, createClient } from "@/lib/supabase";

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

interface ArgumentationAssignmentFormProps {
  currentUserRole: UserRole;
  currentUserSchool?: { id: string; name: string } | null;
  districtName: string;
  districtId: string;
  teacherClasses: ClassPeriod[];
  userId: string;
}

export default function ArgumentationAssignmentForm({
  currentUserRole,
  currentUserSchool,
  districtName,
  districtId,
  teacherClasses,
  userId,
}: ArgumentationAssignmentFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    assignmentName: "",
    description: "",
    course: "",
    dueDate: "",
    prompt: "",
  });

  const [saving, setSaving] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    // Validate required fields
    if (!formData.assignmentName.trim()) {
      alert("Please enter an assignment name");
      return;
    }

    if (!formData.dueDate) {
      alert("Please select a due date");
      return;
    }

    if (!formData.prompt.trim()) {
      alert("Please enter an argumentation prompt");
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      // Create the assignment object (including class_period_id if course is selected)
      const assignmentData = {
        title: formData.assignmentName.trim(),
        description: formData.description.trim() || null,
        due_date: formData.dueDate ? new Date(formData.dueDate + 'T23:59:59.999Z').toISOString() : null,
        teacher_id: userId,
        district_id: districtId,
        school_id: currentUserSchool?.id || null,
        class_period_id: formData.course || null,
        prompt: formData.prompt.trim(),
        writing_style: 'argumentation' as const,
      };

      console.log("Saving argumentation assignment:", assignmentData);

      // Insert into assignments table
      const { data, error } = await supabase
        .from("assignments")
        .insert([assignmentData])
        .select();

      console.log("Insert response:", { data, error });

      if (error) {
        console.error("Error saving assignment:", error);
        alert(`Error saving assignment: ${error.message}\n\nDetails: ${JSON.stringify(error, null, 2)}`);
        setSaving(false);
        return;
      }

      console.log("Argumentation assignment saved successfully:", data);
      alert("✅ Assignment created successfully!");

      setSaving(false);

      // Navigate back to assignments page after saving
      router.push("/dashboard/assignments");
    } catch (error: unknown) {
      console.error("Error saving assignment:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`❌ Error saving assignment: ${errorMessage}`);
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/assignments/create"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Style Selection
          </Link>
        </div>
        <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
          <Printer className="w-5 h-5" />
        </button>
      </div>

      {/* Main Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
        {/* Argumentation Header with Icon */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/argumentation01-circle-cmyk.jpg"
            alt="Argumentation"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            ARGUMENTATION
          </h2>
        </div>

        {/* Form Fields */}
        <div className="space-y-8">
          {/* Assignment Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name Your Assignment
            </label>
            <input
              type="text"
              value={formData.assignmentName}
              onChange={(e) =>
                handleInputChange("assignmentName", e.target.value)
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3d8c33] focus:border-[#3d8c33] text-gray-900"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3d8c33] focus:border-[#3d8c33] text-gray-900"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3d8c33] focus:border-[#3d8c33] text-gray-900"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3d8c33] focus:border-[#3d8c33] text-gray-900"
            />
          </div>

          {/* Enter Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter Prompt
            </label>
            <textarea
              value={formData.prompt}
              onChange={(e) => handleInputChange("prompt", e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3d8c33] focus:border-[#3d8c33] text-gray-900"
              placeholder="Enter the argumentation prompt. This should present a debatable issue or claim that students will need to take a stance on and support with evidence."
            />
            <p className="text-sm text-gray-600 mt-2">
              <strong>Tip:</strong> A good argumentation prompt presents a controversial or debatable topic that allows students to choose a side and defend their position with evidence and reasoning.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-12">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : "Save Assignment"}
          </button>
        </div>
      </div>

      {/* Information Section */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 max-w-4xl mx-auto">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-green-900 mb-2">
            Argumentation Assignment Process
          </h3>
          <p className="text-green-800 mb-4">
            Students will work through a structured argumentation process using the Jane Schaffer methodology, 
            building their argument step by step from evidence gathering to final draft.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-green-700">
            <div className="text-left">
              <h4 className="font-semibold mb-2">Student Workflow Steps:</h4>
              <ul className="space-y-1">
                <li>• Gathering Concrete Details (Evidence)</li>
                <li>• Topic Sentence Development (T-Chart)</li>
                <li>• Working Topic Sentence</li>
                <li>• Commentary Generation</li>
              </ul>
            </div>
            <div className="text-left">
              <h4 className="font-semibold mb-2">Final Steps:</h4>
              <ul className="space-y-1">
                <li>• Shaping the Paragraph</li>
                <li>• Final Draft & Submission</li>
                <li>• Teacher Review & Feedback</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
