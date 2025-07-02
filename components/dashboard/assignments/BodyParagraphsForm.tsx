"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Clock, User, HelpCircle, X } from "lucide-react";
import Link from "next/link";
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

interface FinalDraftData {
  // Title for the paragraph
  paragraphTitle: string;
  // Sentences from shaping sheet
  topicSentence: string;
  chunk1CD: string;
  chunk1CM1: string;
  chunk1CM2: string;
  chunk2CD: string;
  chunk2CM1: string;
  chunk2CM2: string;
  concludingSentence: string;
  selectedChunks: number;
  // Final combined paragraph
  finalParagraph: string;
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
  const [draftData, setDraftData] = useState<FinalDraftData>({
    paragraphTitle: "",
    topicSentence: "",
    chunk1CD: "",
    chunk1CM1: "",
    chunk1CM2: "",
    chunk2CD: "",
    chunk2CM1: "",
    chunk2CM2: "",
    concludingSentence: "",
    selectedChunks: 1,
    finalParagraph: "",
  });
  const [saving, setSaving] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved"
  >("idle");

  // Auto-save functionality with debouncing
  const debouncedAutoSave = useCallback(
    async (data: FinalDraftData) => {
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
          } catch {
            console.log("No existing data to preserve");
          }
        }

        // Merge with existing data to preserve previous steps
        const mergedData = {
          ...existingStepData,
          step7: {
            paragraphTitle: data.paragraphTitle,
            finalParagraph: data.finalParagraph,
          },
          status: "final_draft",
          working_on: "step_7",
        };

        const response = await fetch("/api/student-progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignment_id: assignment.id,
            student_id: studentProfile.id,
            concrete_details: JSON.stringify(mergedData),
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
      if (draftData.paragraphTitle.trim() || draftData.finalParagraph.trim()) {
        debouncedAutoSave(draftData);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [draftData, debouncedAutoSave]);

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

              // Load data from shaping sheet (Step 6)
              let topicSentence = "";
              let chunk1CD = "";
              let chunk1CM1 = "";
              let chunk1CM2 = "";
              let chunk2CD = "";
              let chunk2CM1 = "";
              let chunk2CM2 = "";
              let concludingSentence = "";
              let selectedChunks = 1;

              if (stepData.step6) {
                topicSentence = stepData.step6.topicSentence || "";
                chunk1CD = stepData.step6.chunk1CD || "";
                chunk1CM1 = stepData.step6.chunk1CM1 || "";
                chunk1CM2 = stepData.step6.chunk1CM2 || "";
                chunk2CD = stepData.step6.chunk2CD || "";
                chunk2CM1 = stepData.step6.chunk2CM1 || "";
                chunk2CM2 = stepData.step6.chunk2CM2 || "";
                concludingSentence = stepData.step6.concludingSentence || "";
                selectedChunks = stepData.step6.selectedChunks || 1;
              }

              // Load Step 7 data if returning to this step
              let paragraphTitle = "";
              let finalParagraph = "";
              if (stepData.step7) {
                paragraphTitle = stepData.step7.paragraphTitle || "";
                finalParagraph = stepData.step7.finalParagraph || "";
              }

              // If no final paragraph exists, generate it from individual sentences
              if (!finalParagraph) {
                const tempData = {
                  topicSentence,
                  chunk1CD,
                  chunk1CM1,
                  chunk1CM2,
                  chunk2CD,
                  chunk2CM1,
                  chunk2CM2,
                  concludingSentence,
                  selectedChunks,
                  paragraphTitle,
                  finalParagraph: "",
                };

                const sentences = [];
                // Build paragraph in exact order: TS, CD1, CM1, CM2, CD2, CM3, CM4, CS
                if (tempData.topicSentence.trim())
                  sentences.push(tempData.topicSentence.trim());
                if (tempData.chunk1CD.trim())
                  sentences.push(tempData.chunk1CD.trim());
                if (tempData.chunk1CM1.trim())
                  sentences.push(tempData.chunk1CM1.trim());
                if (tempData.chunk1CM2.trim())
                  sentences.push(tempData.chunk1CM2.trim());
                if (tempData.selectedChunks === 2) {
                  if (tempData.chunk2CD.trim())
                    sentences.push(tempData.chunk2CD.trim());
                  if (tempData.chunk2CM1.trim())
                    sentences.push(tempData.chunk2CM1.trim());
                  if (tempData.chunk2CM2.trim())
                    sentences.push(tempData.chunk2CM2.trim());
                }
                if (tempData.concludingSentence.trim())
                  sentences.push(tempData.concludingSentence.trim());

                finalParagraph = sentences.join(" ");
              }

              setDraftData({
                paragraphTitle,
                topicSentence,
                chunk1CD,
                chunk1CM1,
                chunk1CM2,
                chunk2CD,
                chunk2CM1,
                chunk2CM2,
                concludingSentence,
                selectedChunks,
                finalParagraph,
              });
            } catch {
              console.log("Error parsing step data");
            }
          }
        }
      } catch {
        console.error("Error loading previous data");
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
        } catch {
          console.log("No existing data to preserve");
        }
      }

      // Merge with existing data to preserve previous steps
      const mergedData = {
        ...existingStepData,
        step7: {
          paragraphTitle: draftData.paragraphTitle,
          finalParagraph: draftData.finalParagraph,
        },
        status: "final_draft",
        working_on: "step_7",
      };

      const progressData = {
        assignment_id: assignment.id,
        student_id: studentProfile.id,
        concrete_details: JSON.stringify(mergedData),
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

      alert(`✅ Final draft saved successfully!`);
    } catch (error) {
      console.error("Error saving final draft:", error);
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
      draftData.paragraphTitle.trim().length > 0 &&
      draftData.finalParagraph.trim().length > 0
    );
  };

  // Function to render text with color coding based on sentence position
  const renderColorCodedText = (text: string) => {
    // Split the paragraph into sentences
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim());

    return sentences.map((sentence, index) => {
      let color = "#374151"; // default gray color

      // Simple position-based coloring using inline styles
      if (index === 0) {
        color = "#2563eb"; // TS - Topic Sentence (blue)
      } else if (index === 1) {
        color = "#dc2626"; // CD1 - First Concrete Detail (red)
      } else if (index === 2) {
        color = "#16a34a"; // CM1 - First Commentary (green)
      } else if (index === 3) {
        color = "#16a34a"; // CM2 - Second Commentary (green)
      } else if (index === 4) {
        color = "#dc2626"; // CD2 - Second Concrete Detail (red)
      } else if (index === 5) {
        color = "#16a34a"; // CM3 - Third Commentary (green)
      } else if (index === 6) {
        color = "#16a34a"; // CM4 - Fourth Commentary (green)
      } else if (index === 7) {
        color = "#2563eb"; // CS - Concluding Sentence (blue)
      }

      return (
        <span key={index} style={{ color }}>
          {sentence}
          {index < sentences.length - 1 ? " " : ""}
        </span>
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/assignments/${assignment.id}/shaping`}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Shaping Sheet
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

      {/* Main Form - FINAL DRAFT */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
        {/* Literary Header with Icon and Help */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/literary01-circle-cmyk.jpg"
            alt="Literary"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            RESPONSE TO LITERATURE
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
          {/* Creative Title Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              NOW GIVE A CREATIVE TITLE. IS THERE SOME WORD OR PHRASE IN YOUR
              PARAGRAPH/ESSAY THAT COULD BECOME AN EXCELLENT CREATIVE TITLE?
            </h3>
            <input
              type="text"
              value={draftData.paragraphTitle}
              onChange={(e) =>
                setDraftData((prev) => ({
                  ...prev,
                  paragraphTitle: e.target.value,
                }))
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#23366e] focus:border-[#23366e] text-gray-900 font-medium"
              placeholder="Enter your creative title here..."
            />
          </div>

          {/* Final Paragraph Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Your Final Paragraph
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Your paragraph is color-coded by sentence purpose:
              <span className="text-blue-600 font-medium">
                {" "}
                Topic Sentence (Blue)
              </span>
              ,
              <span className="text-red-600 font-medium">
                {" "}
                Concrete Details (Red)
              </span>
              ,
              <span className="text-green-600 font-medium">
                {" "}
                Commentary (Green)
              </span>
              ,
              <span className="text-blue-600 font-medium">
                {" "}
                Concluding Sentence (Blue)
              </span>
            </p>

            {/* Color-coded preview */}
            {draftData.finalParagraph ? (
              <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-gray-900 leading-relaxed text-lg">
                  <span style={{ color: "#2563eb" }}>
                    {draftData.topicSentence}
                  </span>
                  {draftData.topicSentence && " "}
                  <span style={{ color: "#dc2626" }}>{draftData.chunk1CD}</span>
                  {draftData.chunk1CD && " "}
                  <span style={{ color: "#16a34a" }}>
                    {draftData.chunk1CM1}
                  </span>
                  {draftData.chunk1CM1 && " "}
                  <span style={{ color: "#16a34a" }}>
                    {draftData.chunk1CM2}
                  </span>
                  {draftData.chunk1CM2 && draftData.selectedChunks === 2 && " "}
                  {draftData.selectedChunks === 2 && (
                    <>
                      <span style={{ color: "#dc2626" }}>
                        {draftData.chunk2CD}
                      </span>
                      {draftData.chunk2CD && " "}
                      <span style={{ color: "#16a34a" }}>
                        {draftData.chunk2CM1}
                      </span>
                      {draftData.chunk2CM1 && " "}
                      <span style={{ color: "#16a34a" }}>
                        {draftData.chunk2CM2}
                      </span>
                      {draftData.chunk2CM2 && " "}
                    </>
                  )}
                  {(draftData.chunk1CM2 || draftData.chunk2CM2) && " "}
                  <span style={{ color: "#2563eb" }}>
                    {draftData.concludingSentence}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-500 italic">
                  No paragraph content available. Please go back to the Shaping
                  Sheet to complete your work.
                </p>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Instructions
            </h3>
            <div className="text-gray-700 space-y-2">
              <p>• Review and edit your paragraph for clarity and flow</p>
              <p>• Ensure all sentences work together cohesively</p>
              <p>
                • Check that your concrete details support your topic sentence
              </p>
              <p>
                • Verify that your commentary explains the significance of your
                evidence
              </p>
              <p>
                • Make sure your concluding sentence ties back to your main
                argument
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-12">
          <Link
            href={`/dashboard/assignments/${assignment.id}/shaping`}
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
              if (!isComplete()) {
                alert(
                  "Please complete the title and final paragraph before submitting."
                );
                return;
              }

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
                  } catch {
                    console.log("No existing data to preserve");
                  }
                }

                // Merge with existing data to preserve previous steps
                const mergedData = {
                  ...existingStepData,
                  step7: {
                    paragraphTitle: draftData.paragraphTitle,
                    finalParagraph: draftData.finalParagraph,
                  },
                  status: "submitted",
                  working_on: "completed",
                  submitted_at: new Date().toISOString(),
                };

                const progressData = {
                  assignment_id: assignment.id,
                  student_id: studentProfile.id,
                  concrete_details: JSON.stringify(mergedData),
                  status: "submitted",
                };

                const response = await fetch("/api/student-progress", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(progressData),
                });

                const result = await response.json();

                if (!response.ok) {
                  throw new Error(result.error || "Failed to submit assignment");
                }

                // Redirect to assignment detail page
                window.location.href = `/dashboard/assignments/${assignment.id}`;
              } catch (error) {
                console.error("Error submitting assignment:", error);
                alert(
                  `❌ Error submitting: ${
                    error instanceof Error ? error.message : "Unknown error"
                  }`
                );
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving || !isComplete()}
            className="px-6 py-3 bg-[#3f8b31] text-white rounded-lg hover:bg-[#2d6625] disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Submitting..." : "Complete and Submit"}
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
            <div className="text-2xl font-bold text-[#23366e]">Final Draft</div>
            <div className="text-sm text-[#23366e]">Current Step</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-[#3f8b31]">100%</div>
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
                FINAL DRAFT Tips
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
                <span className="font-semibold text-[#23366e]">1.</span> Create
                a creative title that reflects your main argument or uses a key
                phrase from your paragraph.
              </div>

              <div>
                <span className="font-semibold text-[#23366e]">2.</span> Review
                your paragraph for smooth transitions between sentences.
              </div>

              <div>
                <span className="font-semibold text-[#23366e]">3.</span> Ensure
                your concrete details directly support your topic sentence.
              </div>

              <div>
                <span className="font-semibold text-[#23366e]">4.</span> Check
                that your commentary explains the significance of your evidence.
              </div>

              <div>
                <span className="font-semibold text-[#23366e]">5.</span> Verify
                that your concluding sentence provides closure and reinforces
                your argument.
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
