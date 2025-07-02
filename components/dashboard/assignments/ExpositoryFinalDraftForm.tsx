// components/dashboard/assignments/ExpositoryFinalDraftForm.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Clock, User, HelpCircle, X, Printer } from "lucide-react";
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

interface ExpositoryFinalDraftData {
  // From Shaping Sheet
  topicSentence: string;
  chunk1CD: string;
  chunk2CD: string;
  commentarySentence: string;
  concludingSentence: string;
  selectedChunks: number;
  // Final paragraph
  finalParagraph: string;
  // Creative title
  creativeTitle: string;
}

interface ExpositoryFinalDraftFormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

export default function ExpositoryFinalDraftForm({
  assignment,
  studentProfile,
}: ExpositoryFinalDraftFormProps) {
  const router = useRouter();
  const [finalDraftData, setFinalDraftData] = useState<ExpositoryFinalDraftData>({
    topicSentence: "",
    chunk1CD: "",
    chunk2CD: "",
    commentarySentence: "",
    concludingSentence: "",
    selectedChunks: 1,
    finalParagraph: "",
    creativeTitle: "",
  });
  const [saving, setSaving] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved"
  >("idle");

  // Auto-save functionality with debouncing
  const debouncedAutoSave = useCallback(
    async (data: ExpositoryFinalDraftData) => {
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
          finalDraft: {
            finalParagraph: data.finalParagraph,
            creativeTitle: data.creativeTitle,
          },
          status: "final_draft",
          working_on: "final_draft",
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
      if (finalDraftData.finalParagraph.trim()) {
        debouncedAutoSave(finalDraftData);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [finalDraftData, debouncedAutoSave]);

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
              console.log("Loading Expository Final Draft data:", stepData);

              // Load data from Shaping Sheet
              let topicSentence = "";
              let chunk1CD = "";
              let chunk2CD = "";
              let commentarySentence = "";
              let concludingSentence = "";
              let selectedChunks = 1;

              if (stepData.shapingSheet) {
                topicSentence = stepData.shapingSheet.topicSentence || "";
                chunk1CD = stepData.shapingSheet.chunk1CD || "";
                chunk2CD = stepData.shapingSheet.chunk2CD || "";
                commentarySentence = stepData.shapingSheet.commentarySentence || "";
                concludingSentence = stepData.shapingSheet.concludingSentence || "";
                selectedChunks = stepData.shapingSheet.selectedChunks || 1;
              }

              // Auto-generate the final paragraph from shaping sheet data
              let autoGeneratedParagraph = "";
              if (topicSentence && chunk1CD && commentarySentence && concludingSentence) {
                const sentences = [topicSentence];
                
                if (chunk1CD) sentences.push(chunk1CD);
                if (chunk2CD) sentences.push(chunk2CD);
                if (commentarySentence) sentences.push(commentarySentence);
                if (concludingSentence) sentences.push(concludingSentence);
                
                autoGeneratedParagraph = sentences.join(" ");
              }

              // Load existing final draft data if available, otherwise use auto-generated
              const finalParagraph = stepData.finalDraft?.finalParagraph || autoGeneratedParagraph;

              setFinalDraftData({
                topicSentence,
                chunk1CD,
                chunk2CD,
                commentarySentence,
                concludingSentence,
                selectedChunks,
                finalParagraph,
                creativeTitle: stepData.finalDraft?.creativeTitle || "",
              });

              console.log("Loaded Expository Final Draft data:", {
                topicSentence,
                chunk1CD,
                chunk2CD,
                commentarySentence,
                concludingSentence,
                selectedChunks,
                finalParagraph,
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
        finalDraft: {
          finalParagraph: finalDraftData.finalParagraph,
          creativeTitle: finalDraftData.creativeTitle,
        },
        status: "final_draft",
        working_on: "final_draft",
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

      alert(`✅ Expository final draft saved successfully!`);
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

  const handleSubmit = async () => {
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
        finalDraft: {
          finalParagraph: finalDraftData.finalParagraph,
          creativeTitle: finalDraftData.creativeTitle,
        },
        status: "submitted",
        working_on: "completed",
        submitted_at: new Date().toISOString(),
      };

      const progressData = {
        assignment_id: assignment.id,
        student_id: studentProfile.id,
        concrete_details: JSON.stringify(mergedData),
        writing_style: "expository",
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

      alert("🎉 Assignment submitted successfully! Your teacher will be able to see your submission.");
      router.push(`/dashboard/assignments/${assignment.id}`);
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
  };

  const handlePrint = () => {
    window.print();
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

  // Function to render color-coded paragraph
  const renderColorCodedParagraph = () => {
    const { topicSentence, chunk1CD, chunk2CD, commentarySentence, concludingSentence } = finalDraftData;
    
    if (!finalDraftData.finalParagraph) {
      return <p className="text-gray-500 italic">Your final paragraph will appear here...</p>;
    }

    let paragraph = finalDraftData.finalParagraph;
    let colorCodedElements: JSX.Element[] = [];
    let currentIndex = 0;

    // Helper function to find and highlight a sentence
    const highlightSentence = (sentence: string, color: string, label: string) => {
      if (!sentence.trim()) return;
      
      const index = paragraph.toLowerCase().indexOf(sentence.toLowerCase());
      if (index !== -1) {
        // Add text before the sentence
        if (index > currentIndex) {
          colorCodedElements.push(
            <span key={`text-${currentIndex}`} className="text-gray-900">
              {paragraph.substring(currentIndex, index)}
            </span>
          );
        }
        
        // Add the colored sentence
        colorCodedElements.push(
          <span 
            key={`${label}-${index}`} 
            className={color}
            title={label}
          >
            {paragraph.substring(index, index + sentence.length)}
          </span>
        );
        
        currentIndex = index + sentence.length;
      }
    };

    // Highlight sentences in order
    highlightSentence(topicSentence, "text-blue-600", "Topic Sentence (TS)");
    highlightSentence(chunk1CD, "text-red-600", "Concrete Detail 1 (CD)");
    if (chunk2CD) {
      highlightSentence(chunk2CD, "text-red-600", "Concrete Detail 2 (CD)");
    }
    highlightSentence(commentarySentence, "text-green-600", "Commentary (CM)");
    highlightSentence(concludingSentence, "text-blue-600", "Concluding Sentence (CS)");

    // Add any remaining text
    if (currentIndex < paragraph.length) {
      colorCodedElements.push(
        <span key={`text-end`} className="text-gray-900">
          {paragraph.substring(currentIndex)}
        </span>
      );
    }

    return (
      <div className="leading-relaxed">
        {colorCodedElements.length > 0 ? colorCodedElements : (
          <span className="text-gray-900">{paragraph}</span>
        )}
      </div>
    );
  };

  // Validation for completion
  const isComplete = () => {
    return finalDraftData.finalParagraph.trim().length > 0;
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

        {/* Print and Due Date */}
        <div className="flex items-center gap-4">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Printer className="w-5 h-5" />
            Print
          </button>

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

      {/* Main Form - EXPOSITORY FINAL DRAFT */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
        {/* Expository Header with Icon and Help */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/expository01-circle-cmyk.jpg"
            alt="Expository"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            FINAL DRAFT
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
          {/* Creative Title Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              NOW GIVE A CREATIVE TITLE. IS THERE SOME WORD OR PHRASE IN YOUR PARAGRAPH/ESSAY THAT COULD BECOME AN EXCELLENT, CREATIVE TITLE?
            </h3>
            
            <div className="p-4 border-2 border-gray-300 rounded-lg bg-gray-50">
              <input
                type="text"
                value={finalDraftData.creativeTitle}
                onChange={(e) =>
                  setFinalDraftData((prev) => ({
                    ...prev,
                    creativeTitle: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 border-0 focus:outline-none text-gray-900 bg-transparent text-base"
                placeholder="Be Sensible"
              />
            </div>
          </div>

          {/* Color-Coded Paragraph */}
          <div className="space-y-4">
            <div className="p-6 border-2 border-gray-300 rounded-lg bg-white min-h-[300px]">
              <div className="text-base leading-relaxed">
                {renderColorCodedParagraph()}
              </div>
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
            className="px-6 py-3 bg-[#4dd0e1] text-white rounded-lg hover:bg-[#26c6da] disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : "Save"}
          </button>

          <button
            onClick={async () => {
              if (!isComplete()) {
                alert("Please complete your final paragraph before submitting.");
                return;
              }
              await handleSubmit();
            }}
            disabled={saving || !isComplete()}
            className="px-6 py-3 bg-[#3f8b31] text-white rounded-lg hover:bg-[#2d6625] disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Submitting..." : "Submit Assignment"}
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
            <div className="text-2xl font-bold text-[#8bb3ff]">Final Draft</div>
            <div className="text-sm text-[#8bb3ff]">Current Step</div>
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
                EXPOSITORY FINAL DRAFT Tips
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
                <span className="font-semibold text-[#8bb3ff]">1.</span> Read through your entire paragraph to ensure smooth flow between sentences.
              </div>

              <div>
                <span className="font-semibold text-[#8bb3ff]">2.</span> Check that your topic sentence clearly introduces your main idea.
              </div>

              <div>
                <span className="font-semibold text-[#8bb3ff]">3.</span> Verify that your concrete details support your topic sentence.
              </div>

              <div>
                <span className="font-semibold text-[#8bb3ff]">4.</span> Ensure your commentary explains the significance of your concrete details.
              </div>

              <div>
                <span className="font-semibold text-[#8bb3ff]">5.</span> Confirm your concluding sentence provides closure and reinforces your main point.
              </div>

              <div>
                <span className="font-semibold text-[#8bb3ff]">6.</span> Use the color-coded preview to verify all sentence types are included.
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
