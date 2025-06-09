// components/dashboard/assignments/GatheringCdsForm.tsx
"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Clock, User, HelpCircle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserProfile } from "@/lib/supabase";

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

interface GatheringCdsFormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

export default function GatheringCdsForm({
  assignment,
  studentProfile,
}: GatheringCdsFormProps) {
  const router = useRouter();
  const [chunk1CDs, setChunk1CDs] = useState<string[]>([]);
  const [chunk2CDs, setChunk2CDs] = useState<string[]>([]);
  const [selectedChunk1CD, setSelectedChunk1CD] = useState<number | null>(null);
  const [selectedChunk2CD, setSelectedChunk2CD] = useState<number | null>(null);
  const [currentChunk1Input, setCurrentChunk1Input] = useState("");
  const [currentChunk2Input, setCurrentChunk2Input] = useState("");
  const [selectedChunks, setSelectedChunks] = useState(1); // Default to 1, will be loaded from previous step
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);

  const addChunk1CD = () => {
    if (currentChunk1Input.trim()) {
      setChunk1CDs([...chunk1CDs, currentChunk1Input.trim()]);
      setCurrentChunk1Input("");
    }
  };

  const addChunk2CD = () => {
    if (currentChunk2Input.trim()) {
      setChunk2CDs([...chunk2CDs, currentChunk2Input.trim()]);
      setCurrentChunk2Input("");
    }
  };

  const selectChunk1CD = (index: number) => {
    setSelectedChunk1CD(selectedChunk1CD === index ? null : index);
  };

  const selectChunk2CD = (index: number) => {
    setSelectedChunk2CD(selectedChunk2CD === index ? null : index);
  };

  // Load previous step data on component mount
  useEffect(() => {
    const loadPreviousData = async () => {
      try {
        const response = await fetch(`/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`);
        const result = await response.json();
        
        if (response.ok && result.data) {
          // Load selectedChunks from previous step
          if (result.data.selected_chunks) {
            setSelectedChunks(result.data.selected_chunks);
          }
          
          // Load any existing CD data if returning to this step
          if (result.data.concrete_details) {
            try {
              const cdData = JSON.parse(result.data.concrete_details);
              if (cdData.chunk1CDs) setChunk1CDs(cdData.chunk1CDs);
              if (cdData.chunk2CDs) setChunk2CDs(cdData.chunk2CDs);
              if (cdData.selectedChunk1CD !== undefined) setSelectedChunk1CD(cdData.selectedChunk1CD);
              if (cdData.selectedChunk2CD !== undefined) setSelectedChunk2CD(cdData.selectedChunk2CD);
              if (cdData.selectedChunks) setSelectedChunks(cdData.selectedChunks);
            } catch (error) {
              console.log("No existing CD data to load");
            }
          }
        }
      } catch (error) {
        console.error("Error loading previous data:", error);
      }
    };

    loadPreviousData();
  }, [assignment.id, studentProfile.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save the CDs and selections to the existing progress record
      const progressData = {
        assignment_id: assignment.id,
        student_id: studentProfile.id,
        concrete_details: JSON.stringify({
          chunk1CDs,
          chunk2CDs,
          selectedChunk1CD,
          selectedChunk2CD,
          selectedChunks
        }),
        status: "in_progress",
      };

      console.log("Saving CDs and selections:", progressData);

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

      alert(`✅ CDs saved successfully!`);
      
    } catch (error) {
      console.error("Error saving CDs:", error);
      alert(`❌ Error saving: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Save and submit the assignment
      await handleSave();
      
      // TODO: Mark assignment as submitted
      console.log("Submitting assignment with concrete details");
      
      alert("Assignment submitted successfully!");
      router.push(`/dashboard/assignments/${assignment.id}`);
    } catch (error) {
      console.error("Error submitting assignment:", error);
      alert("Error submitting assignment. Please try again.");
    } finally {
      setSubmitting(false);
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
            href={`/dashboard/assignments/${assignment.id}/start`}
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

      {/* Main Form - GATHERING CDS */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
        {/* Literary Header with Icon and Help */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/literary01-circle-cmyk.jpg"
            alt="Literary"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            GATHERING CDS
          </h2>
          <button
            onClick={() => setShowTipModal(true)}
            className="p-2 text-gray-500 hover:text-[#23366e] transition-colors"
            title="Show tips"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <div className="space-y-8">
          {/* Writing Prompt - Read Only for Reference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Writing Prompt
            </label>
            <div className="w-full px-4 py-3 border border-[#23366e] rounded-lg bg-[#23366e] text-white">
              {assignment.prompt || "No prompt provided"}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <p className="text-sm font-medium text-gray-700">
              Think of two or more possible concrete details (CDS). That would fit the prompt and write them below.
            </p>
          </div>

          {/* CDs for Chunk 1 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 uppercase">
              CDs for Chunk 1
            </h3>
            
            {/* Input for new CD */}
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                value={currentChunk1Input}
                onChange={(e) => setCurrentChunk1Input(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addChunk1CD()}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b3172c] focus:border-[#b3172c] text-[#13161f]"
                placeholder="Enter a concrete detail for chunk 1..."
              />
              <button
                onClick={addChunk1CD}
                className="px-6 py-3 bg-[#23366e] text-white rounded-lg hover:bg-[#1a2a5a] transition-colors font-medium"
              >
                Add CD
              </button>
            </div>

            {/* Display added CDs */}
            <div className="space-y-2">
              {chunk1CDs.map((cd, index) => (
                <div
                  key={index}
                  onClick={() => selectChunk1CD(index)}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors text-[#13161f] ${
                    selectedChunk1CD === index
                      ? "border-[#3f8b31] bg-green-50 ring-2 ring-[#3f8b31]"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  {cd}
                </div>
              ))}
            </div>
          </div>

          {/* CDs for Chunk 2 - Only show if selectedChunks is 2 */}
          {selectedChunks === 2 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 uppercase">
                CDs for Chunk 2
              </h3>
              
              {/* Input for new CD */}
              <div className="flex gap-3 mb-4">
                <input
                  type="text"
                  value={currentChunk2Input}
                  onChange={(e) => setCurrentChunk2Input(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addChunk2CD()}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b3172c] focus:border-[#b3172c] text-[#13161f]"
                  placeholder="Enter a concrete detail for chunk 2..."
                />
                <button
                  onClick={addChunk2CD}
                  className="px-6 py-3 bg-[#23366e] text-white rounded-lg hover:bg-[#1a2a5a] transition-colors font-medium"
                >
                  Add CD
                </button>
              </div>

              {/* Display added CDs */}
              <div className="space-y-2">
                {chunk2CDs.map((cd, index) => (
                  <div
                    key={index}
                    onClick={() => selectChunk2CD(index)}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors text-[#13161f] ${
                      selectedChunk2CD === index
                        ? "border-[#3f8b31] bg-green-50 ring-2 ring-[#3f8b31]"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {cd}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selection Instructions */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Click the one CD per chunk which fits the assignment best.
            </h3>
            <p className="text-gray-700">
              Click or tap "Save and Next" when you have selected your best CDs.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-12">
          <Link
            href={`/dashboard/assignments/${assignment.id}/start`}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Back
          </Link>

          <button
            onClick={handleSave}
            disabled={saving || submitting}
            className="px-6 py-3 bg-[#13161f] text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : "Save"}
          </button>

          <button
            onClick={async () => {
              await handleSave();
              // TODO: Navigate to next step
              console.log("Save and Next clicked");
            }}
            disabled={saving || submitting}
            className="px-6 py-3 bg-[#3f8b31] text-white rounded-lg hover:bg-[#2d6625] disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : "Save and Next"}
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
            <div className="text-2xl font-bold text-[#23366e]">Gathering CDS</div>
            <div className="text-sm text-[#23366e]">Current Step</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-[#3f8b31]">
              50%
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

      {/* Tip Modal */}
      {showTipModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">GATHERING CDS Tips</h3>
              <button
                onClick={() => setShowTipModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 text-gray-700">
              <div>
                <span className="font-semibold text-[#23366e]">1.</span> LIST AND ADD 3-5 concrete details (CDs), but you may also add as many as you like. You may click &lt;Add CD&gt; or touch "Enter" on the keyboard to add CDs.
              </div>
              
              <div>
                <span className="font-semibold text-[#23366e]">2.</span> You may list several and then combine them into one sentence on a CD line and select that one.
              </div>
              
              <div>
                <span className="font-semibold text-[#23366e]">3.</span> HIGHLIGHT the one line of CDs that you want to use for each chunk. Remember, for literary analysis, the ratio is 1:2+, so this step helps you combine the CDs you want into one sentence.
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowTipModal(false)}
                className="px-4 py-2 bg-[#23366e] text-white rounded-lg hover:bg-[#1a2a5a] transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
