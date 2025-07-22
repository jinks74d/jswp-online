// components/dashboard/assignments/NarrativeAssignmentForm.tsx
"use client";

import { useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRole } from "@/lib/supabase";

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

interface NarrativeAssignmentFormProps {
  currentUserRole: UserRole;
  currentUserSchool?: { id: string; name: string } | null;
  districtName: string;
  districtId: string;
  teacherClasses: ClassPeriod[];
  userId: string;
}

export default function NarrativeAssignmentForm({
  currentUserSchool,
  districtId,
  teacherClasses,
  userId,
}: NarrativeAssignmentFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    assignmentName: "",
    description: "",
    course: "",
    dueDate: "",
    narrativeType: "personal", // personal or fictional
    organizationType: "event", // event or ppt (person/place/thing)
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
      alert("Please enter a narrative prompt");
      return;
    }

    setSaving(true);

    try {
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
        writing_style: 'narrative' as const,
      };

      console.log("Saving narrative assignment:", assignmentData);

      // Use MCP to save to database
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(assignmentData),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Error saving assignment:", result);
        alert(`Error saving assignment: ${result.error || 'Unknown error'}`);
        setSaving(false);
        return;
      }

      console.log("Narrative assignment saved successfully:", result);
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
        {/* Narrative Header with Icon */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/narrative01-circle-cmyk.jpg"
            alt="Narrative"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            NARRATIVE
          </h2>
        </div>

        {/* Form Fields */}
        <div className="space-y-8">
          {/* Assignment Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ASSIGNMENT NAME
            </label>
            <input
              type="text"
              value={formData.assignmentName}
              onChange={(e) =>
                handleInputChange("assignmentName", e.target.value)
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#13161f] focus:border-[#13161f] text-gray-900"
              placeholder="Name Your Assignment"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#13161f] focus:border-[#13161f] text-gray-900"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#13161f] focus:border-[#13161f] text-gray-900"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#13161f] focus:border-[#13161f] text-gray-900"
            />
          </div>

          {/* Narrative Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Narrative Type
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="narrativeType"
                  value="personal"
                  checked={formData.narrativeType === "personal"}
                  onChange={(e) => handleInputChange("narrativeType", e.target.value)}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium text-gray-900">Personal Narrative</div>
                  <div className="text-sm text-gray-600">Students write about their own experiences</div>
                </div>
              </label>
              <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="narrativeType"
                  value="fictional"
                  checked={formData.narrativeType === "fictional"}
                  onChange={(e) => handleInputChange("narrativeType", e.target.value)}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium text-gray-900">Fictional Narrative</div>
                  <div className="text-sm text-gray-600">Students create imaginary stories</div>
                </div>
              </label>
            </div>
          </div>

          {/* Organization Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Organization Type
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="organizationType"
                  value="event"
                  checked={formData.organizationType === "event"}
                  onChange={(e) => handleInputChange("organizationType", e.target.value)}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium text-gray-900">Event Organization</div>
                  <div className="text-sm text-gray-600">Beginning → Middle → End</div>
                </div>
              </label>
              <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="organizationType"
                  value="ppt"
                  checked={formData.organizationType === "ppt"}
                  onChange={(e) => handleInputChange("organizationType", e.target.value)}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium text-gray-900">Person/Place/Thing</div>
                  <div className="text-sm text-gray-600">Three reasons about the topic</div>
                </div>
              </label>
            </div>
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#13161f] focus:border-[#13161f] text-gray-900"
              placeholder="Enter the narrative prompt. For example: 'Write about a time when you learned something important about life and discuss how it affected you.' or 'Write about a person who has influenced you in a good way and say why.'"
            />
            <p className="text-sm text-gray-600 mt-2">
              <strong>Tip:</strong> Good narrative prompts encourage students to tell stories about personal experiences, memorable events, or meaningful people, places, or things in their lives.
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
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 max-w-4xl mx-auto">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Narrative Assignment Process
          </h3>
          <p className="text-gray-800 mb-4">
            Students will work through a structured narrative process using the Jane Schaffer methodology, 
            building their story step by step with a 2+:1 ratio (more concrete details, fewer commentary sentences).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
            <div className="text-left">
              <h4 className="font-semibold mb-2">Student Workflow Steps:</h4>
              <ul className="space-y-1">
                <li>• Discovering the Topic</li>
                <li>• Gathering CDs (who, what, when, where, dialogue)</li>
                <li>• Working Topic Sentence (with feelings)</li>
                <li>• Shaping the Story</li>
              </ul>
            </div>
            <div className="text-left">
              <h4 className="font-semibold mb-2">Final Steps:</h4>
              <ul className="space-y-1">
                <li>• Final Draft with Creative Title</li>
                <li>• Past Tense Consistency</li>
                <li>• Teacher Review & Feedback</li>
                <li>• Story Submission</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
