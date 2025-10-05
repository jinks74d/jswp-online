// components/dashboard/assignments/ExpositoryShapingSheetForm.tsx
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
  writing_style: string;
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

interface ExpositoryShapingData {
  // Topic Sentence
  topicSentence: string;
  // Concrete Details
  chunk1CD: string;
  chunk2CD: string;
  // Commentary
  commentarySentence: string;
  // Concluding Sentence
  concludingSentence: string;
  // Number of chunks being used
  selectedChunks: number;
}

interface ExpositoryShapingSheetFormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

export default function ExpositoryShapingSheetForm({
  assignment,
  studentProfile,
}: ExpositoryShapingSheetFormProps) {
  const router = useRouter();
  const [shapingData, setShapingData] = useState<ExpositoryShapingData>({
    topicSentence: "",
    chunk1CD: "",
    chunk2CD: "",
    commentarySentence: "",
    concludingSentence: "",
    selectedChunks: 1,
  });
  const [saving, setSaving] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved"
  >("idle");

  // Auto-save functionality with debouncing
  const debouncedAutoSave = useCallback(
    async (data: ExpositoryShapingData) => {
      setAutoSaveStatus("saving");
      try {
        // First get existing data to preserve previous steps
        const existingResponse = await fetch(
          `/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`
        );
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
          shapingSheet: {
            topicSentence: data.topicSentence,
            chunk1CD: data.chunk1CD,
            chunk2CD: data.chunk2CD,
            commentarySentence: data.commentarySentence,
            concludingSentence: data.concludingSentence,
            selectedChunks: data.selectedChunks,
          },
          status: "shaping_sheet",
          working_on: "shaping_sheet",
        };

        const response = await fetch("/api/student-progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignment_id: assignment.id,
            student_id: studentProfile.id,
            concrete_details: JSON.stringify(mergedData),
            writing_style: "expository",
          }),
        });

        if (response.ok) {
          setAutoSaveStatus("saved");
          setTimeout(() => setAutoSaveStatus("idle"), 2000);
        }
      } catch (error) {
        console.error("Auto-save failed:", error);
        setAutoSaveStatus("idle");
      }
    },
    [assignment.id, studentProfile.id]
  );

  // Auto-save when data changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (
        shapingData.topicSentence.trim() ||
        shapingData.chunk1CD.trim() ||
        shapingData.commentarySentence.trim() ||
        shapingData.concludingSentence.trim()
      ) {
        debouncedAutoSave(shapingData);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [shapingData, debouncedAutoSave]);

  // Load previous step data on component mount
  useEffect(() => {
    const loadPreviousData = async () => {
      try {
        const response = await fetch(
          `/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`
        );
        const result = await response.json();

        if (response.ok && result.data) {
          if (result.data.concrete_details) {
            try {
              const stepData = JSON.parse(result.data.concrete_details);
              console.log("Loading Expository Shaping Sheet data:", stepData);

              // Load data from Commentary Development step
              let topicSentence = "";
              let commentarySentence = "";
              let concludingSentence = "";
              let selectedChunks = 1;

              // Load revised topic sentence from Commentary Development
              if (stepData.revisedTopicSentence) {
                topicSentence = stepData.revisedTopicSentence;
              }

              // Load commentary and concluding sentences from Commentary Development
              if (stepData.commentarySentence) {
                commentarySentence = stepData.commentarySentence;
              }
              if (stepData.concludingSentence) {
                concludingSentence = stepData.concludingSentence;
              }

              // Load selected chunks
              if (stepData.selectedChunks) {
                selectedChunks = stepData.selectedChunks;
              }

              // Load concrete details from selected CDs
              let chunk1CD = "";
              let chunk2CD = "";

              if (stepData.cdSections && Array.isArray(stepData.cdSections)) {
                // Get CDs from cdSections
                if (stepData.cdSections[0]?.cdText) {
                  chunk1CD = stepData.cdSections[0].cdText;
                }
                if (stepData.cdSections[1]?.cdText) {
                  chunk2CD = stepData.cdSections[1].cdText;
                }
              } else {
                // Fallback to old structure
                if (stepData.chunk1CDs && stepData.selectedChunk1CD !== null) {
                  chunk1CD =
                    stepData.chunk1CDs[stepData.selectedChunk1CD] || "";
                }
                if (stepData.chunk2CDs && stepData.selectedChunk2CD !== null) {
                  chunk2CD =
                    stepData.chunk2CDs[stepData.selectedChunk2CD] || "";
                }
              }

              // Always prioritize existing shaping sheet data if available
              setShapingData({
                topicSentence:
                  stepData.shapingSheet?.topicSentence || topicSentence,
                chunk1CD: stepData.shapingSheet?.chunk1CD || chunk1CD,
                chunk2CD: stepData.shapingSheet?.chunk2CD || chunk2CD,
                commentarySentence:
                  stepData.shapingSheet?.commentarySentence ||
                  commentarySentence,
                concludingSentence:
                  stepData.shapingSheet?.concludingSentence ||
                  concludingSentence,
                selectedChunks:
                  stepData.shapingSheet?.selectedChunks || selectedChunks,
              });

              console.log("Loaded Expository Shaping Sheet data:", {
                topicSentence:
                  stepData.shapingSheet?.topicSentence || topicSentence,
                chunk1CD: stepData.shapingSheet?.chunk1CD || chunk1CD,
                chunk2CD: stepData.shapingSheet?.chunk2CD || chunk2CD,
                commentarySentence:
                  stepData.shapingSheet?.commentarySentence ||
                  commentarySentence,
                concludingSentence:
                  stepData.shapingSheet?.concludingSentence ||
                  concludingSentence,
                selectedChunks:
                  stepData.shapingSheet?.selectedChunks || selectedChunks,
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
      const existingResponse = await fetch(
        `/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`
      );
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
        shapingSheet: {
          topicSentence: shapingData.topicSentence,
          chunk1CD: shapingData.chunk1CD,
          chunk2CD: shapingData.chunk2CD,
          commentarySentence: shapingData.commentarySentence,
          concludingSentence: shapingData.concludingSentence,
          selectedChunks: shapingData.selectedChunks,
        },
        status: "shaping_sheet",
        working_on: "shaping_sheet",
      };

      const progressData = {
        assignment_id: assignment.id,
        student_id: studentProfile.id,
        concrete_details: JSON.stringify(mergedData),
        writing_style: "expository",
        status: "in_progress",
      };

      const response = await fetch("/api/student-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(progressData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save progress");
      }

      alert(`✅ Expository shaping sheet saved successfully!`);
    } catch (error) {
      console.error("Error saving shaping sheet:", error);
      alert(
        `❌ Error saving: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
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
    return (
      shapingData.topicSentence.trim().length > 0 &&
      shapingData.chunk1CD.trim().length > 0 &&
      shapingData.chunk2CD.trim().length > 0 &&
      shapingData.commentarySentence.trim().length > 0 &&
      shapingData.concludingSentence.trim().length > 0
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/assignments/${assignment.id}/commentary?step=3`}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Commentary Development
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
            src="/assets/expository01-circle-cmyk.jpg"
            alt="Expository"
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

      {/* Main Form - EXPOSITORY SHAPING SHEET */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
        {/* Expository Header with Icon and Help */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/expository01-circle-cmyk.jpg"
            alt="Expository"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            THE SHAPING SHEET
          </h2>
          <button
            onClick={() => setShowTipModal(true)}
            className="p-2 text-gray-500 hover:text-[#8bb3ff] transition-colors"
            title="Show tips"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {/* Auto-save status indicator */}
          <div className="ml-auto">
            {autoSaveStatus === "saving" && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                Saving...
              </div>
            )}
            {autoSaveStatus === "saved" && (
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
          {/* The Prompt */}
          <div className="text-center">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              THE PROMPT:
            </h3>
            <div className="p-4 bg-[#8bb3ff] text-white rounded-lg">
              <p className="font-medium">
                {assignment.prompt ||
                  "IN A ONE-CHUNK EXPOSITORY PARAGRAPH (2+:1), DISCUSS SOME EFFECTIVE ADVICE YOU LEARNED ON STAYING HEALTHY DURING THE COLD AND FLU SEASON."}
              </p>
            </div>
          </div>

          {/* Topic Sentence */}
          <div className="text-center">
            <div className="inline-block">
              {/* TS Header - Pentagon/Trapezoid Shape */}
              <div className="relative">
                <div
                  className="bg-blue-600 text-white px-8 py-3 font-bold text-lg"
                  style={{
                    clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)",
                    minWidth: "120px",
                    textAlign: "center",
                  }}
                >
                  TS
                </div>
              </div>
              <div className="p-6 border-2 border-blue-600 rounded-b-lg bg-blue-50 min-w-[600px]">
                <textarea
                  value={shapingData.topicSentence}
                  onChange={(e) =>
                    setShapingData((prev) => ({
                      ...prev,
                      topicSentence: e.target.value,
                    }))
                  }
                  rows={4}
                  className="w-full px-3 py-2 border-0 focus:outline-none text-blue-800 bg-transparent resize-none text-base"
                  placeholder="Enter your topic sentence here..."
                />
              </div>
            </div>
          </div>

          {/* Concrete Detail 1 */}
          <div className="text-center">
            <div className="inline-block">
              <div className="bg-[#b3172c] text-white px-8 py-3 rounded-t-lg font-bold text-lg">
                CD
              </div>
              <div className="p-6 border-2 border-[#b3172c] bg-red-50 min-w-[600px] border-t-0">
                <textarea
                  value={shapingData.chunk1CD}
                  onChange={(e) =>
                    setShapingData((prev) => ({
                      ...prev,
                      chunk1CD: e.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full px-3 py-2 border-0 focus:outline-none text-red-800 bg-transparent resize-none text-base"
                  placeholder="Enter your first concrete detail here..."
                />
              </div>
            </div>
          </div>

          {/* Concrete Detail 2 */}
          <div className="text-center">
            <div className="inline-block">
              <div className="p-6 border-2 border-[#b3172c] bg-red-50 min-w-[600px] border-t-0">
                <textarea
                  value={shapingData.chunk2CD}
                  onChange={(e) =>
                    setShapingData((prev) => ({
                      ...prev,
                      chunk2CD: e.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full px-3 py-2 border-0 focus:outline-none text-red-800 bg-transparent resize-none text-base"
                  placeholder="Enter your second concrete detail here..."
                />
              </div>
            </div>
          </div>

          {/* Commentary */}
          <div className="text-center">
            <div className="inline-block">
              {/* CM Header - Oval Shape */}
              <div className="relative mb-4">
                <div
                  className="bg-green-600 text-white px-12 py-4 font-bold text-lg mx-auto"
                  style={{
                    borderRadius: "50px",
                    minWidth: "120px",
                    textAlign: "center",
                  }}
                >
                  CM
                </div>
              </div>
              <div className="p-6 border-2 border-green-600 rounded-lg bg-green-50 min-w-[600px]">
                <textarea
                  value={shapingData.commentarySentence}
                  onChange={(e) =>
                    setShapingData((prev) => ({
                      ...prev,
                      commentarySentence: e.target.value,
                    }))
                  }
                  rows={4}
                  className="w-full px-3 py-2 border-0 focus:outline-none text-green-800 bg-transparent resize-none text-base"
                  placeholder="Enter your commentary sentence here..."
                />
              </div>
            </div>
          </div>

          {/* Concluding Sentence */}
          <div className="text-center">
            <div className="inline-block">
              {/* CS Header - Pentagon/Trapezoid Shape */}
              <div className="relative">
                <div
                  className="bg-blue-600 text-white px-8 py-3 font-bold text-lg"
                  style={{
                    clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)",
                    minWidth: "120px",
                    textAlign: "center",
                  }}
                >
                  CS
                </div>
              </div>
              <div className="p-6 border-2 border-blue-600 rounded-b-lg bg-blue-50 min-w-[600px]">
                <textarea
                  value={shapingData.concludingSentence}
                  onChange={(e) =>
                    setShapingData((prev) => ({
                      ...prev,
                      concludingSentence: e.target.value,
                    }))
                  }
                  rows={4}
                  className="w-full px-3 py-2 border-0 focus:outline-none text-blue-800 bg-transparent resize-none text-base"
                  placeholder="Enter your concluding sentence here..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-12">
          <Link
            href={`/dashboard/assignments/${assignment.id}/commentary?step=3`}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Back
          </Link>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-[#4dd0e1] text-white rounded-lg hover:bg-[#26c6da] disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : "Save"}
          </button>

          <button
            onClick={async () => {
              await handleSave();
              if (!saving && isComplete()) {
                router.push(
                  `/dashboard/assignments/${assignment.id}/final-draft`
                );
              } else if (!isComplete()) {
                alert("Please complete all required fields before continuing.");
              }
            }}
            disabled={saving || !isComplete()}
            className="px-6 py-3 bg-[#4dd0e1] text-white rounded-lg hover:bg-[#26c6da] disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : "Save and Next"}
          </button>
        </div>
      </div>

      {/* Assignment Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Expository Assignment Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-[#8bb3ff]">
              Shaping Sheet
            </div>
            <div className="text-sm text-[#8bb3ff]">Current Step</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-[#3f8b31]">95%</div>
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
              <h3 className="text-xl font-bold text-gray-900">
                EXPOSITORY SHAPING SHEET Tips
              </h3>
              <button
                onClick={() => setShowTipModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-gray-700">
              <div>
                <span className="font-semibold text-[#8bb3ff]">1.</span> Review
                and refine your topic sentence to clearly address the prompt
                about staying healthy.
              </div>

              <div>
                <span className="font-semibold text-[#8bb3ff]">2.</span> Edit
                your concrete details to be specific and relevant to health
                advice.
              </div>

              <div>
                <span className="font-semibold text-[#8bb3ff]">3.</span>{" "}
                Strengthen your commentary to explain how the advice contributes
                to health and well-being.
              </div>

              <div>
                <span className="font-semibold text-[#8bb3ff]">4.</span> Ensure
                your concluding sentence reinforces the importance of following
                health advice.
              </div>

              <div>
                <span className="font-semibold text-[#8bb3ff]">5.</span> Check
                that all elements work together to create a cohesive expository
                paragraph.
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowTipModal(false)}
                className="px-4 py-2 bg-[#8bb3ff] text-white rounded-lg hover:bg-[#7aa3ff] transition-colors"
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
