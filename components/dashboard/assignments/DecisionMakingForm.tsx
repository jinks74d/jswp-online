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

interface DecisionData {
  topicSentenceWord: string;
  chunk1CM1: string;
  chunk1CM2: string;
  chunk2CM1: string;
  chunk2CM2: string;
  selectedCD1: string;
  selectedCD2: string;
  chunk1Words: string[];
  chunk2Words: string[];
  selectedChunks: number;
}

interface DecisionMakingFormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

export default function DecisionMakingForm({
  assignment,
  studentProfile,
}: DecisionMakingFormProps) {
  const router = useRouter();
  const [decisionData, setDecisionData] = useState<DecisionData>({
    topicSentenceWord: "",
    chunk1CM1: "",
    chunk1CM2: "",
    chunk2CM1: "",
    chunk2CM2: "",
    selectedCD1: "",
    selectedCD2: "",
    chunk1Words: ["", "", "", "", ""],
    chunk2Words: ["", "", "", "", ""],
    selectedChunks: 1
  });
  const [saving, setSaving] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Auto-save functionality with debouncing
  const debouncedAutoSave = useCallback(
    async (data: DecisionData) => {
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
          step3: data,
          status: "making_decisions",
          working_on: "step_3"
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
      if (decisionData.topicSentenceWord || decisionData.chunk1CM1 || decisionData.chunk1CM2) {
        debouncedAutoSave(decisionData);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [decisionData, debouncedAutoSave]);

  // Load previous step data on component mount
  useEffect(() => {
    const loadPreviousData = async () => {
      try {
        const response = await fetch(`/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`);
        const result = await response.json();
        
        console.log("Loading previous data for decisions:", result);
        
        if (response.ok && result.data) {
          if (result.data.concrete_details) {
            try {
              const stepData = JSON.parse(result.data.concrete_details);
              console.log("Parsed step data:", stepData);
              
              // Load Step 1 data (selected CDs) - check multiple possible data structures
              let selectedCD1 = "";
              let selectedCD2 = "";
              let selectedChunks = 1;
              
              // Check for Step 1 data in various formats
              if (stepData.chunk1CDs && stepData.selectedChunk1CD !== null) {
                selectedCD1 = stepData.chunk1CDs[stepData.selectedChunk1CD] || "";
                selectedChunks = stepData.selectedChunks || 1;
                console.log("Found chunk1 CD:", selectedCD1);
              }
              
              if (stepData.chunk2CDs && stepData.selectedChunk2CD !== null) {
                selectedCD2 = stepData.chunk2CDs[stepData.selectedChunk2CD] || "";
                selectedChunks = 2;
                console.log("Found chunk2 CD:", selectedCD2);
              }
              
              // Also check if CDs are stored directly in step data
              if (stepData.selectedCD1) {
                selectedCD1 = stepData.selectedCD1;
                console.log("Found direct selectedCD1:", selectedCD1);
              }
              
              if (stepData.selectedCD2) {
                selectedCD2 = stepData.selectedCD2;
                selectedChunks = 2;
                console.log("Found direct selectedCD2:", selectedCD2);
              }

              // Load Step 2 data (commentary words)
              let chunk1Words = ["", "", "", "", ""];
              let chunk2Words = ["", "", "", "", ""];
              
              if (stepData.step2) {
                chunk1Words = stepData.step2.chunk1Words || ["", "", "", "", ""];
                chunk2Words = stepData.step2.chunk2Words || ["", "", "", "", ""];
                console.log("Found step2 words:", { chunk1Words, chunk2Words });
              }

              // Update state with all loaded data in a single update
              // Only load step3 data if the words match current step2 data
              const step3Data = stepData.step3 || {};
              const allCurrentWords = chunk1Words.concat(chunk2Words).filter(word => word.trim());
              
              // Check if step3 selections are valid for current words
              const isValidCM1 = step3Data.chunk1CM1 && allCurrentWords.includes(step3Data.chunk1CM1);
              const isValidCM2 = step3Data.chunk1CM2 && allCurrentWords.includes(step3Data.chunk1CM2);
              const isValidChunk2CM1 = step3Data.chunk2CM1 && allCurrentWords.includes(step3Data.chunk2CM1);
              const isValidChunk2CM2 = step3Data.chunk2CM2 && allCurrentWords.includes(step3Data.chunk2CM2);
              const isValidTopicWord = step3Data.topicSentenceWord && allCurrentWords.includes(step3Data.topicSentenceWord);
              
              setDecisionData(prev => ({
                ...prev,
                selectedCD1,
                selectedCD2,
                selectedChunks,
                chunk1Words,
                chunk2Words,
                topicSentenceWord: isValidTopicWord ? step3Data.topicSentenceWord : "",
                chunk1CM1: isValidCM1 ? step3Data.chunk1CM1 : "",
                chunk1CM2: isValidCM2 ? step3Data.chunk1CM2 : "",
                chunk2CM1: isValidChunk2CM1 ? step3Data.chunk2CM1 : "",
                chunk2CM2: isValidChunk2CM2 ? step3Data.chunk2CM2 : ""
              }));
              
              if (stepData.step3) {
                console.log("Loaded step3 data:", stepData.step3);
              }
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

  const handleWordSelection = (field: keyof DecisionData, value: string) => {
    console.log(`Selecting ${field}: ${value}`);
    console.log('Current state before update:', decisionData);
    setDecisionData(prev => {
      const newState = {
        ...prev,
        [field]: value
      };
      console.log('New state after update:', newState);
      return newState;
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
        step3: decisionData,
        status: "making_decisions",
        working_on: "step_3"
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

      alert(`✅ Decisions saved successfully!`);
      
    } catch (error) {
      console.error("Error saving decisions:", error);
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

  // Validate 1:2+ ratio
  const validateRatio = () => {
    if (decisionData.selectedChunks === 1) {
      return decisionData.topicSentenceWord && decisionData.chunk1CM1 && decisionData.chunk1CM2;
    } else {
      const chunk1Count = [decisionData.chunk1CM1, decisionData.chunk1CM2].filter(Boolean).length;
      const chunk2Count = [decisionData.chunk2CM1, decisionData.chunk2CM2].filter(Boolean).length;
      return decisionData.topicSentenceWord && chunk1Count >= 1 && (chunk1Count + chunk2Count) >= 3;
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

      {/* Main Form - MAKING DECISIONS */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
        {/* Literary Header with Icon and Help */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/literary01-circle-cmyk.jpg"
            alt="Literary"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            MAKING DECISIONS
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
          {/* Topic Sentence Word Selection */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Select ONE word for your topic sentence:
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {decisionData.chunk1Words.concat(decisionData.chunk2Words).filter(word => word.trim()).map((word, index) => (
                <button
                  key={index}
                  onClick={() => handleWordSelection('topicSentenceWord', word)}
                  className={`px-4 py-3 rounded-lg border transition-colors text-left ${
                    decisionData.topicSentenceWord === word
                      ? "bg-[#23366e] text-white border-[#23366e]"
                      : "bg-white text-gray-900 border-gray-300 hover:border-[#23366e] hover:bg-blue-50"
                  }`}
                >
                  {word}
                </button>
              ))}
            </div>
          </div>

          {/* Chunk 1 Commentary Selection */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Select commentary words for Chunk 1 (choose 2):
            </h3>
            <div className="mb-4 p-4 bg-red-50 rounded-lg border border-red-200">
              <h4 className="text-red-800 font-medium mb-2">Your CD (Chunk 1):</h4>
              <p className="text-red-700">{decisionData.selectedCD1 || "No CD selected"}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 mb-4">
              {decisionData.chunk1Words.filter(word => word.trim()).map((word, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (decisionData.chunk1CM1 === word) {
                      handleWordSelection('chunk1CM1', '');
                    } else if (decisionData.chunk1CM2 === word) {
                      handleWordSelection('chunk1CM2', '');
                    } else if (!decisionData.chunk1CM1) {
                      handleWordSelection('chunk1CM1', word);
                    } else if (!decisionData.chunk1CM2) {
                      handleWordSelection('chunk1CM2', word);
                    }
                  }}
                  className={`px-4 py-3 rounded-lg border transition-colors text-left ${
                    decisionData.chunk1CM1 === word || decisionData.chunk1CM2 === word
                      ? "bg-[#3f8b31] text-white border-[#3f8b31]"
                      : "bg-white text-gray-900 border-gray-300 hover:border-[#3f8b31] hover:bg-green-50"
                  }`}
                >
                  {word}
                </button>
              ))}
            </div>
            <div className="text-sm text-gray-600">
              Selected: {[decisionData.chunk1CM1, decisionData.chunk1CM2].filter(Boolean).join(', ') || 'None'}
            </div>
          </div>

          {/* Chunk 2 Commentary Selection - Show if we have chunk 2 data */}
          {(decisionData.selectedChunks === 2 || decisionData.selectedCD2 || decisionData.chunk2Words.some(word => word.trim())) && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Select commentary words for Chunk 2 (choose up to 2):
              </h3>
              <div className="mb-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="text-red-800 font-medium mb-2">Your CD (Chunk 2):</h4>
                <p className="text-red-700">{decisionData.selectedCD2 || "No CD selected"}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 mb-4">
                {decisionData.chunk2Words.filter(word => word.trim()).map((word, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (decisionData.chunk2CM1 === word) {
                        handleWordSelection('chunk2CM1', '');
                      } else if (decisionData.chunk2CM2 === word) {
                        handleWordSelection('chunk2CM2', '');
                      } else if (!decisionData.chunk2CM1) {
                        handleWordSelection('chunk2CM1', word);
                      } else if (!decisionData.chunk2CM2) {
                        handleWordSelection('chunk2CM2', word);
                      }
                    }}
                    className={`px-4 py-3 rounded-lg border transition-colors text-left ${
                      decisionData.chunk2CM1 === word || decisionData.chunk2CM2 === word
                        ? "bg-[#3f8b31] text-white border-[#3f8b31]"
                        : "bg-white text-gray-900 border-gray-300 hover:border-[#3f8b31] hover:bg-green-50"
                    }`}
                  >
                    {word}
                  </button>
                ))}
              </div>
              <div className="text-sm text-gray-600">
                Selected: {[decisionData.chunk2CM1, decisionData.chunk2CM2].filter(Boolean).join(', ') || 'None'}
              </div>
            </div>
          )}

          {/* Ratio Validation */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              1:2+ Ratio Check
            </h3>
            <p className="text-gray-700 mb-4">
              For literary analysis, you need 1 concrete detail for every 2+ commentary sentences.
            </p>
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full ${validateRatio() ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={validateRatio() ? 'text-green-700' : 'text-red-700'}>
                {validateRatio() ? 'Ratio requirement met!' : 'Please select more commentary words to meet the 1:2+ ratio'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-12">
          <Link
            href={`/dashboard/assignments/${assignment.id}/commentary`}
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
              if (!saving && validateRatio()) {
                router.push(`/dashboard/assignments/${assignment.id}/elaboration`);
              } else if (!validateRatio()) {
                alert("Please meet the 1:2+ ratio requirement before continuing.");
              }
            }}
            disabled={saving || !validateRatio()}
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
            <div className="text-2xl font-bold text-[#23366e]">Making Decisions</div>
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
              <h3 className="text-xl font-bold text-gray-900">MAKING DECISIONS Tips</h3>
              <button
                onClick={() => setShowTipModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 text-gray-700">
              <div>
                <span className="font-semibold text-[#23366e]">1.</span> Choose ONE word for your topic sentence that best represents your main argument.
              </div>
              
              <div>
                <span className="font-semibold text-[#23366e]">2.</span> Select commentary words that will help you explain the significance of your concrete details.
              </div>
              
              <div>
                <span className="font-semibold text-[#23366e]">3.</span> Remember the 1:2+ ratio: For every concrete detail, you need at least 2 commentary sentences.
              </div>
              
              <div>
                <span className="font-semibold text-[#23366e]">4.</span> Choose words that will help you create strong, analytical commentary about character development.
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
