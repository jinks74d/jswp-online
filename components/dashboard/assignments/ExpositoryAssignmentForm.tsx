// components/dashboard/assignments/ExpositoryAssignmentForm.tsx
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

interface ExpositoryAssignmentFormProps {
  currentUserRole: UserRole;
  currentUserSchool?: { id: string; name: string } | null;
  districtName: string;
  districtId: string;
  teacherClasses: ClassPeriod[];
  userId: string;
  userName: string;
}

export default function ExpositoryAssignmentForm({
  currentUserRole,
  currentUserSchool,
  districtName,
  districtId,
  teacherClasses,
  userId,
  userName,
}: ExpositoryAssignmentFormProps) {
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
    setSaving(true);

    try {
      const supabase = createClient();

      // Create the assignment object
      const assignmentData = {
        title: formData.assignmentName,
        description: formData.description,
        due_date: formData.dueDate,
        teacher_id: userId,
        district_id: districtId,
        school_id: currentUserSchool?.id,
        class_period_id: formData.course || null,
        prompt: formData.prompt,
        writing_style: "expository", // Add writing style
      };

      console.log("Saving expository assignment:", assignmentData);

      // Insert into assignments table
      const { data, error } = await supabase
        .from("assignments")
        .insert([assignmentData])
        .select();

      console.log("Insert response:", { data, error });

      if (error) {
        console.error("Error saving assignment:", error);
        alert(`Error saving assignment: ${error.message}`);
        setSaving(false);
        return;
      }

      console.log("Expository assignment saved successfully:", data);

      setSaving(false);

      // Navigate back to assignments page after saving
      router.push("/dashboard/assignments");
    } catch (error: any) {
      console.error("Error saving assignment:", error);
      alert(`Error saving assignment: ${error?.message || 'Unknown error'}`);
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
        {/* Expository Header with Icon */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/expository01-circle-cmyk.jpg"
            alt="Expository"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            EXPOSITORY
          </h2>
        </div>

        {/* Subtitle */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-700">
            {userName.toUpperCase()}, NAME YOUR NEW ASSIGNMENT
          </h3>
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22356d] focus:border-[#22356d] text-gray-900"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22356d] focus:border-[#22356d] text-gray-900"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22356d] focus:border-[#22356d] text-gray-900"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22356d] focus:border-[#22356d] text-gray-900"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22356d] focus:border-[#22356d] text-gray-900"
              placeholder="Enter the writing prompt for this expository assignment"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-12">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-[#4dd0e1] text-white rounded-lg hover:bg-[#26c6da] disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Development Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-4xl mx-auto">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Expository Assignment Form
          </h3>
          <p className="text-blue-800 mb-4">
            This is the teacher form for creating Expository writing assignments. 
            The form captures basic assignment information that will guide students 
            through the expository writing process.
          </p>
          <div className="text-sm text-blue-700">
            <p>
              <strong>Next:</strong> Student workflow forms will be added for the complete 
              expository writing process including gathering evidence, organizing ideas, 
              and developing analytical commentary.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
