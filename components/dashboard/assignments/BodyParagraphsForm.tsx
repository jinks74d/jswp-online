"use client";

import { useState, useEffect, useCallback } from "react";
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

interface BodyParagraphData {
  topicSentence: string;
  chunk1CD: string;
  chunk1CM1: string;
  chunk1CM2: string;
  chunk2CD: string;
  chunk2CM1: string;
  chunk2CM2: string;
  selectedChunks: number;
  chunk1Paragraph: string;
  chunk2Paragraph: string;
}

interface BodyParagraphsFormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

export default function BodyParagraphsForm({
  assignment,
  studentProfile,
}: BodyParagraphsFormProps) {
  const router = useRouter();
  const [bodyData, setBodyData] = useState<BodyParagraphData>({
    topicSentence: "",
    chunk1CD: "",
    chunk1CM1: "",
    chunk1CM2: "",
    chunk2CD: "",
    chunk2CM1: "",
    chunk2CM2: "",
    selectedChunks: 1,
    chunk1Paragraph: "",
    chunk2Paragraph: ""
  });
  const [saving, setSaving] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Auto-save functionality with debouncing
  const debouncedAutoSave = useCallback(
    async (data: BodyParagraphData) => {
      setAutoSaveStatus('saving');
      try {
        // First get existing data to preserve previous steps
        const existingResponse = await fetch(`/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`);
        const existingResult = await existingResponse.json();
        
        let existingStepData = {};
        if (existingResponse.ok && existingResult.data?.concrete_details) {
          try {
            existingStepData = JSON.parse(existingResult.data.concrete_details);
          } catch (error) {
            console.log("No existing data to preserve");
          }
        }

        // Merge with existing data to preserve previous steps
        const mergedData = {
          ...existingStepData,
          step5: {
            chunk1Paragraph: data.chunk1Paragraph,
            chunk2Paragraph: data.chunk2Paragraph
          },
          status: "writing_body_paragraphs",
          working_on: "step_5"
        };

        const response = await fetch('/api/student-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignment_id: assignment.id,
            student_id: studentProfile.id,
            concrete_details: JSON.stringify(mergedData)
          })
        });

        if (response.ok) {
          setAutoSaveStatus('saved');
          setTimeout(() => setAutoSaveStatus('idle'), 2000);
        }
      } catch (error) {
        console.error("Auto-save failed:", error);
        setAutoSaveStatus('idle');
      }
    },
    [assignment.id, studentProfile.id]
  );

  // Auto-save when data changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (bodyData.chunk1Paragraph.trim() || bodyData.chunk2Paragraph.trim()) {
        debouncedAutoSave(bodyData);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [bodyData, debouncedAutoSave]);

  // Load previous step data on component mount
  useEffect(() => {
    const loadPreviousData = async () => {
      try {
        const response = await fetch(`/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`);
        const result = await response.json();
        
        if (response.ok && result.data) {
          if (result.data.concrete_details) {
            try {
              const stepData = JSON.parse(result.data.concrete_details);
              
              // Load data from previous steps
              let chunk1CD = "";
              let chunk2CD = "";
              let selectedChunks = 1;
              let topicSentence = "";
              let chunk1CM1 = "";
              let chunk1CM2 = "";
              let chunk2CM1 = "";
              let chunk2CM2 = "";
              
              // Load Step 1 data (CDs)
              if (stepData.chunk1CDs && stepData.selectedChunk1CD !== null) {
                chunk1CD = stepData.chunk1CDs[stepData.selectedChunk1CD] || "";
                selectedChunks = stepData.selectedChunks || 1;
              }
              
              if (stepData.chunk2CDs && stepData.selectedChunk2CD !== null) {
                chunk2CD = stepData.chunk2CDs[stepData.selectedChunk2CD] || "";
                selectedChunks = 2;
              }
              
              // Load Step 3 data (decisions)
              if (stepData.step3) {
                chunk1CM1 = stepData.step3.chunk1CM1 || "";
                chunk1CM2 = stepData.step3.chunk1CM2 || "";
                chunk2CM1 = stepData.step3.chunk2CM1 || "";
                chunk2CM2 = stepData.step3.chunk2CM2 || "";
              }

              // Load Step 4 data (topic sentence)
              if (stepData.step4) {
                topicSentence = stepData.step4.topicSentence || "";
              }

              // Load Step 5 data if returning to this step
              let chunk1Paragraph = "";
              let chunk2Paragraph = "";
              if (stepData.step5) {
                chunk1Paragraph = stepData.step5.chunk1Paragraph || "";
                chunk2Paragraph = stepData.step5.chunk2Paragraph || "";
              }

              setBodyData({
                topicSentence,
                chunk1CD,
                chunk1CM1,
                chunk1CM2,
                chunk2CD,
                chunk2CM1,
                chunk2CM2,
                selectedChunks,
                chunk1Paragraph,
                chunk2Paragraph
              });
              
            } catch (error) {
              console.log("Error parsing step data:", error);
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
      // First get existing data to preserve previous steps
      const existingResponse = await fetch(`/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`);
      const existingResult = await existingResponse.json();
      
      let existingStepData = {};
      if (existingResponse.ok && existingResult.data?.concrete_details) {
        try {
          existingStepData = JSON.parse(existingResult.data.concrete_details);
        } catch (error) {
          console.log("No existing data to preserve");
        }
      }

      // Merge with existing data to preserve previous steps
      const mergedData = {
        ...existingStepData,
        step5: {
          chunk1Paragraph: bodyData.chunk1Paragraph,
          chunk2Paragraph: bodyData.chunk2Paragraph
        },
        status: "writing_body_paragraphs",
        working_on: "step_5"
      };

      const progressData = {
        assignment_id: assignment.id,
        student_id: studentProfile.id,
        concrete_details: JSON.stringify(mergedData),
        status: "in_progress",
      };

      const response = await fetch('/api/student-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progressData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save progress');
      }

      alert(`✅ Body paragraphs saved successfully!`);
      
    } catch (error) {
      console.error("Error saving body paragraphs:", error);
      alert(`❌ Error saving: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  // Validation for completion
  const isComplete = () => {
    if (bodyData.selectedChunks === 1) {
      return bodyData.chunk1Paragraph.trim().length > 0;
    } else {
      return bodyData.chunk1Paragraph.trim().length > 0 && bodyData.chunk2Paragraph.trim().length > 0;
    }
  };

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
      </div>

      {/* Main Form - BODY PARAGRAPHS */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
        {/* Literary Header with Icon and Help */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/literary01-circle-cmyk.jpg"
            alt="Literary"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            BODY PARAGRAPHS
          </h2>
          <button
            onClick={() => setShowTipModal(true)}
            className="p-2 text-gray-500 hover:text-[#23366e] transition-colors"
            title="Show tips"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
          
          {/* Auto-save status indicator */}
          <div className="ml-auto">
            {autoSaveStatus === 'saving' && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                Saving...
              </div>
            )}
            {autoSaveStatus === 'saved' && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
                Saved
              </div>
            )}
          </div>
        </div>

        {/* Form Content */}
        <div className="space-y-8">
          {/* Display topic sentence */}
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <h3 className="text-blue-800 font-medium mb-2">Your Topic Sentence:</h3>
            <p className="text-blue-700 italic">{bodyData.topicSentence || "No topic sentence created yet"}</p>
          </div>

          {/* Body Paragraph 1 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Body Paragraph 1
            </h3>
            
            {/* Reference materials for Chunk 1 */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <h4 className="font-medium text-gray-800 mb-2">Your Elements for Chunk 1:</h4>
              <div className="space-y-2 text-sm text-gray-700">
                <div><span className="font-medium">CD:</span> {bodyData.chunk1CD || "None selected"}</div>
                <div><span className="font-medium">Commentary Words:</span> {[bodyData.chunk1CM1, bodyData.chunk1CM2].filter(Boolean).join(', ') || "None selected"}</div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Write your body paragraph using the CD and commentary words above:
              </label>
              <textarea
                value={bodyData.chunk1Paragraph}
                onChange={(e) => setBodyData(prev => ({ ...prev, chunk1Paragraph: e.target.value }))}
                rows={8}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#23366e] focus:border-[#23366e] text-[#13161f]"
                placeholder="Write your body paragraph here. Include your concrete detail and develop it with commentary using your selected words..."
              />
            </div>
          </div>

          {/* Body Paragraph 2 - Only show if we have chunk 2 data */}
          {bodyData.selectedChunks === 2 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Body Paragraph 2
              </h3>
              
              {/* Reference materials for Chunk 2 */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h4 className="font-medium text-gray-800 mb-2">Your Elements for Chunk 2:</h4>
                <div className="space-y-2 text-sm text-gray-700">
                  <div><span className="font-medium">CD:</span> {bodyData.chunk2CD || "None selected"}</div>
                  <div><span className="font-medium">Commentary Words:</span> {[bodyData.chunk2CM1, bodyData.chunk2CM2].filter(Boolean).join(', ') || "None selected"}</div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Write your second body paragraph using the CD and commentary words above:
                </label>
                <textarea
                  value={bodyData.chunk2Paragraph}
                  onChange={(e) => setBodyData(prev => ({ ...prev, chunk2Paragraph: e.target.value }))}
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#23366e] focus:border-[#23366e] text-[#13161f]"
                  placeholder="Write your second body paragraph here. Include your concrete detail and develop it with commentary using your selected words..."
                />
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Instructions
            </h3>
            <div className="text-gray-700 space-y-2">
              <p>• Start each paragraph with a transition or topic sentence that connects to your main argument</p>
              <p>• Include your concrete detail (CD) with proper citation</p>
              <p>• Follow with commentary (CM) that explains the significance using your selected words</p>
              <p>• Maintain the 1:2+ ratio (1 concrete detail for every 2+ commentary sentences)</p>
              <p>• End with a concluding sentence that ties back to your thesis</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-12">
          <Link
            href={`/dashboard/assignments/${assignment.id}/elaboration`}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Back
          </Link>

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
              if (!saving && isComplete()) {
                router.push(`/dashboard/assignments/${assignment.id}/first-draft`);
              } else if (!isComplete()) {
                alert("Please complete all required body paragraphs before continuing.");
              }
            }}
            disabled={saving || !isComplete()}
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
            <div className="text-2xl font-bold text-[#23366e]">Body Paragraphs</div>
            <div className="text-sm text-[#23366e]">Current Step</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-[#3f8b31]">
              83%
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
              <h3 className="text-xl font-bold text-gray-900">BODY PARAGRAPHS Tips</h3>
              <button
                onClick={() => setShowTipModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 text-gray-700">
              <div>
                <span className="font-semibold text-[#23366e]">1.</span> Start with a transition that connects to your topic sentence.
              </div>
              
              <div>
                <span className="font-semibold text-[#23366e]">2.</span> Include your concrete detail with proper citation (author, page number).
              </div>
              
              <div>
                <span className="font-semibold text-[#23366e]">3.</span> Follow with 2+ commentary sentences that explain the significance.
              </div>
              
              <div>
                <span className="font-semibold text-[#23366e]">4.</span> Use your selected commentary words to develop your analysis.
              </div>
              
              <div>
                <span className="font-semibold text-[#23366e]">5.</span> End with a concluding sentence that ties back to your main argument.
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
