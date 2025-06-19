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

interface CommentaryData {
  chunk1Words: string[];
  chunk2Words: string[];
  selectedCD1: string;
  selectedCD2: string;
  selectedChunks: number;
}

interface CommentaryGenerationFormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

export default function CommentaryGenerationForm({
  assignment,
  studentProfile,
}: CommentaryGenerationFormProps) {
  const router = useRouter();
  const [commentaryData, setCommentaryData] = useState<CommentaryData>({
    chunk1Words: ["", "", "", "", ""],
    chunk2Words: ["", "", "", "", ""],
    selectedCD1: "",
    selectedCD2: "",
    selectedChunks: 1
  });
  const [saving, setSaving] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Auto-save functionality with debouncing
  const debouncedAutoSave = useCallback(
    async (data: CommentaryData) => {
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
          step2: data,
          status: "generating_commentary",
          working_on: "step_2"
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
      if (commentaryData.chunk1Words.some(word => word.trim()) || 
          commentaryData.chunk2Words.some(word => word.trim())) {
        debouncedAutoSave(commentaryData);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [commentaryData, debouncedAutoSave]);

  // Load previous step data on component mount
  useEffect(() => {
    const loadPreviousData = async () => {
      try {
        const response = await fetch(`/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`);
        const result = await response.json();
        
        if (response.ok && result.data) {
          // Load CDs from Step 1
          if (result.data.concrete_details) {
            try {
              const stepData = JSON.parse(result.data.concrete_details);
              
              // Load Step 1 data (selected CDs)
              if (stepData.chunk1CDs && stepData.selectedChunk1CD !== null) {
                setCommentaryData(prev => ({
                  ...prev,
                  selectedCD1: stepData.chunk1CDs[stepData.selectedChunk1CD] || "",
                  selectedChunks: stepData.selectedChunks || 1
                }));
              }
              
              if (stepData.chunk2CDs && stepData.selectedChunk2CD !== null && stepData.selectedChunks === 2) {
                setCommentaryData(prev => ({
                  ...prev,
                  selectedCD2: stepData.chunk2CDs[stepData.selectedChunk2CD] || ""
                }));
              }

              // Load Step 2 data if returning to this step
              if (stepData.step2) {
                setCommentaryData(prev => ({
                  ...prev,
                  chunk1Words: stepData.step2.chunk1Words || ["", "", "", "", ""],
                  chunk2Words: stepData.step2.chunk2Words || ["", "", "", "", ""]
                }));
              }
            } catch (error) {
              console.log("No existing step data to load");
            }
          }
        }
      } catch (error) {
        console.error("Error loading previous data:", error);
      }
    };

    loadPreviousData();
  }, [assignment.id, studentProfile.id]);

  const updateWord = (chunkNumber: 1 | 2, index: number, value: string) => {
    setCommentaryData(prev => {
      const wordsKey = `chunk${chunkNumber}Words` as 'chunk1Words' | 'chunk2Words';
      const currentWords = prev[wordsKey];
      const updatedWords = currentWords.map((word: string, i: number) => 
        i === index ? value : word
      );
      
      return {
        ...prev,
        [wordsKey]: updatedWords
      };
    });
  };

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
        step2: commentaryData,
        status: "generating_commentary",
        working_on: "step_2"
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

      alert(`✅ Commentary words saved successfully!`);
      
    } catch (error) {
      console.error("Error saving commentary:", error);
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

      {/* Main Form - GENERATING COMMENTARY */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
        {/* Literary Header with Icon and Help */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/literary01-circle-cmyk.jpg"
            alt="Literary"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            GENERATING COMMENTARY
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
          {/* Display selected CD from Step 1 */}
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <h3 className="text-red-800 font-medium mb-2">Your Selected CD (Chunk 1):</h3>
            <p className="text-red-700">{commentaryData.selectedCD1 || "No CD selected from previous step"}</p>
          </div>

          {/* Word input for Chunk 1 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Brainstorm 5 single words that describe how this action makes the character feel:
            </h3>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(num => (
                <div key={num} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#b3172c] text-white rounded-full flex items-center justify-center text-sm font-medium">
                    {num}
                  </div>
                  <input
                    type="text"
                    value={commentaryData.chunk1Words[num - 1]}
                    onChange={(e) => updateWord(1, num - 1, e.target.value)}
                    placeholder={`Word ${num}`}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b3172c] focus:border-[#b3172c] text-[#13161f]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Chunk 2 section - Only show if selectedChunks is 2 */}
          {commentaryData.selectedChunks === 2 && (
            <>
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <h3 className="text-red-800 font-medium mb-2">Your Selected CD (Chunk 2):</h3>
                <p className="text-red-700">{commentaryData.selectedCD2 || "No CD selected from previous step"}</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Brainstorm 5 single words that describe how this action makes the character feel:
                </h3>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(num => (
                    <div key={num} className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-[#b3172c] text-white rounded-full flex items-center justify-center text-sm font-medium">
                        {num}
                      </div>
                      <input
                        type="text"
                        value={commentaryData.chunk2Words[num - 1]}
                        onChange={(e) => updateWord(2, num - 1, e.target.value)}
                        placeholder={`Word ${num}`}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b3172c] focus:border-[#b3172c] text-[#13161f]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Instructions */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Instructions
            </h3>
            <p className="text-gray-700">
              Think about how the character feels as a result of the action described in your concrete detail. 
              Write single words that capture these emotions or feelings. These words will become the foundation 
              for your commentary in the next step.
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
            disabled={saving}
            className="px-6 py-3 bg-[#13161f] text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : "Save"}
          </button>

          <button
            onClick={async () => {
              await handleSave();
              if (!saving) {
                router.push(`/dashboard/assignments/${assignment.id}/decisions`);
              }
            }}
            disabled={saving}
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
            <div className="text-2xl font-bold text-[#23366e]">Generating Commentary</div>
            <div className="text-sm text-[#23366e]">Current Step</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-[#3f8b31]">
              33%
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
              <h3 className="text-xl font-bold text-gray-900">GENERATING COMMENTARY Tips</h3>
              <button
                onClick={() => setShowTipModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 text-gray-700">
              <div>
                <span className="font-semibold text-[#23366e]">1.</span> Think about the character's emotional response to the action in your concrete detail.
              </div>
              
              <div>
                <span className="font-semibold text-[#23366e]">2.</span> Use single words that describe feelings, emotions, or states of mind.
              </div>
              
              <div>
                <span className="font-semibold text-[#23366e]">3.</span> These words will help you build commentary that explains the significance of your concrete details.
              </div>
              
              <div>
                <span className="font-semibold text-[#23366e]">4.</span> Examples: frustrated, determined, hopeful, anxious, proud, confused, etc.
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
