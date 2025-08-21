// components/dashboard/assignments/ArgumentationFinalDraftForm.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Clock, User, HelpCircle, X, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserProfile } from "@/lib/supabase";
import { SafeHTML } from "@/lib/sanitization";

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

interface ArgumentationFinalDraftData {
  // From Shaping Sheet
  topicSentence: string;
  concessionCounterargument: string;
  refutation: string;
  concreteDetails: string[];
  commentarySentence: string;
  concludingSentence: string;
  // Final paragraph
  finalParagraph: string;
  // Creative title
  creativeTitle: string;
}

interface ArgumentationFinalDraftFormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

export default function ArgumentationFinalDraftForm({
  assignment,
  studentProfile,
}: ArgumentationFinalDraftFormProps) {
  const router = useRouter();
  const [finalDraftData, setFinalDraftData] = useState<ArgumentationFinalDraftData>({
    topicSentence: "",
    concessionCounterargument: "",
    refutation: "",
    concreteDetails: [],
    commentarySentence: "",
    concludingSentence: "",
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
    async (data: ArgumentationFinalDraftData) => {
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
            writing_style: "argumentation",
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
              console.log("Loading Argumentation Final Draft data:", stepData);

              // Load data from Shaping Sheet
              let topicSentence = "";
              let concessionCounterargument = "";
              let refutation = "";
              let concreteDetails: string[] = [];
              let commentarySentence = "";
              let concludingSentence = "";

              if (stepData.shapingSheet) {
                topicSentence = stepData.shapingSheet.topicSentence || "";
                concessionCounterargument = stepData.shapingSheet.concessionCounterargument || "";
                refutation = stepData.shapingSheet.refutation || "";
                concreteDetails = stepData.shapingSheet.concreteDetails || [];
                commentarySentence = stepData.shapingSheet.commentarySentence || "";
                concludingSentence = stepData.shapingSheet.concludingSentence || "";
              }

              // Auto-generate the final paragraph from shaping sheet data
              let autoGeneratedParagraph = "";
              if (topicSentence && concessionCounterargument && refutation && commentarySentence && concludingSentence) {
                const sentences = [topicSentence];
                
                if (concessionCounterargument) sentences.push(concessionCounterargument);
                if (refutation) sentences.push(refutation);
                
                // Add concrete details
                concreteDetails.forEach(cd => {
                  if (cd.trim()) sentences.push(cd);
                });
                
                if (commentarySentence) sentences.push(commentarySentence);
                if (concludingSentence) sentences.push(concludingSentence);
                
                autoGeneratedParagraph = sentences.join(" ");
              }

              // Load existing final draft data if available, otherwise use auto-generated
              const finalParagraph = stepData.finalDraft?.finalParagraph || autoGeneratedParagraph;

              setFinalDraftData({
                topicSentence,
                concessionCounterargument,
                refutation,
                concreteDetails,
                commentarySentence,
                concludingSentence,
                finalParagraph,
                creativeTitle: stepData.finalDraft?.creativeTitle || "",
              });

              console.log("Loaded Argumentation Final Draft data:", {
                topicSentence,
                concessionCounterargument,
                refutation,
                concreteDetails,
                commentarySentence,
                concludingSentence,
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
        writing_style: "argumentation",
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

      alert(`✅ Argumentation final draft saved successfully!`);
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
        writing_style: "argumentation",
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

  // Function to render color-coded paragraph as HTML string
  const renderColorCodedParagraphHTML = () => {
    const { topicSentence, concessionCounterargument, refutation, concreteDetails, commentarySentence, concludingSentence } = finalDraftData;
    
    if (!finalDraftData.finalParagraph) {
      return '<span class="text-gray-500 italic">Your final paragraph will appear here...</span>';
    }

    const paragraph = finalDraftData.finalParagraph;
    
    // Split paragraph into sentences for better identification
    const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim());
    
    // If we have sentences and original components, apply colors based on position and content
    if (sentences.length > 0 && (topicSentence || concessionCounterargument || refutation || concreteDetails.length > 0 || commentarySentence || concludingSentence)) {
      let coloredHtml = '';
      let usedIndices = new Set();
      
      // Helper function to find best sentence match (allows for modifications)
      const findBestMatch = (originalSentence: string, color: string, label: string) => {
        if (!originalSentence.trim()) return;
        
        for (let i = 0; i < sentences.length; i++) {
          if (usedIndices.has(i)) continue;
          
          const currentSentence = sentences[i].trim();
          const original = originalSentence.trim();
          
          // Check for exact match first
          if (currentSentence.toLowerCase().includes(original.toLowerCase()) || 
              original.toLowerCase().includes(currentSentence.toLowerCase())) {
            usedIndices.add(i);
            return { index: i, sentence: currentSentence, color, label };
          }
          
          // Check for partial match (at least 50% word overlap)
          const currentWords = currentSentence.toLowerCase().split(/\s+/);
          const originalWords = original.toLowerCase().split(/\s+/);
          const commonWords = currentWords.filter(word => originalWords.includes(word));
          
          if (commonWords.length >= Math.min(currentWords.length, originalWords.length) * 0.5) {
            usedIndices.add(i);
            return { index: i, sentence: currentSentence, color, label };
          }
        }
        return null;
      };
      
      // Apply colors based on logical order and content matching
      const coloredSentences = [];
      
      // 1. Topic Sentence (usually first, should stay blue)
      if (topicSentence) {
        const tsMatch = findBestMatch(topicSentence, "text-blue-600", "Topic Sentence (TS)");
        if (tsMatch) {
          coloredSentences[tsMatch.index] = tsMatch;
        } else if (sentences.length > 0 && !usedIndices.has(0)) {
          // If no match found, color the first sentence as TS
          coloredSentences[0] = { index: 0, sentence: sentences[0], color: "text-blue-600", label: "Topic Sentence (TS)" };
          usedIndices.add(0);
        }
      }
      
      // 2. Concession/Counterargument
      if (concessionCounterargument) {
        const ccMatch = findBestMatch(concessionCounterargument, "text-gray-600", "Concession/Counterargument");
        if (ccMatch) {
          coloredSentences[ccMatch.index] = ccMatch;
        }
      }
      
      // 3. Refutation
      if (refutation) {
        const refMatch = findBestMatch(refutation, "text-gray-600", "Refutation");
        if (refMatch) {
          coloredSentences[refMatch.index] = refMatch;
        }
      }
      
      // 4. Concrete Details
      concreteDetails.forEach((cd, cdIndex) => {
        const cdMatch = findBestMatch(cd, "text-red-600", `Concrete Detail ${cdIndex + 1} (CD)`);
        if (cdMatch) {
          coloredSentences[cdMatch.index] = cdMatch;
        }
      });
      
      // 5. Commentary
      if (commentarySentence) {
        const cmMatch = findBestMatch(commentarySentence, "text-green-600", "Commentary (CM)");
        if (cmMatch) {
          coloredSentences[cmMatch.index] = cmMatch;
        }
      }
      
      // 6. Concluding Sentence (usually last, should stay blue)
      if (concludingSentence) {
        const csMatch = findBestMatch(concludingSentence, "text-blue-600", "Concluding Sentence (CS)");
        if (csMatch) {
          coloredSentences[csMatch.index] = csMatch;
        } else if (sentences.length > 1 && !usedIndices.has(sentences.length - 1)) {
          // If no match found, color the last sentence as CS
          const lastIndex = sentences.length - 1;
          coloredSentences[lastIndex] = { index: lastIndex, sentence: sentences[lastIndex], color: "text-blue-600", label: "Concluding Sentence (CS)" };
          usedIndices.add(lastIndex);
        }
      }
      
      // Build the colored HTML
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();
        if (!sentence) continue;
        
        if (coloredSentences[i]) {
          const colored = coloredSentences[i];
          coloredHtml += `<span class="${colored.color}" title="${colored.label}">${sentence}</span>`;
        } else {
          coloredHtml += `<span class="text-gray-900">${sentence}</span>`;
        }
        
        // Add period back if it was removed and not the last sentence
        if (i < sentences.length - 1) {
          coloredHtml += '. ';
        } else {
          coloredHtml += '.';
        }
      }
      
      return coloredHtml;
    }
    
    // Fallback to original exact matching if no structured data
    return `<span class="text-gray-900">${paragraph}</span>`;
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
            src="/assets/argumentation01-circle-cmyk.jpg"
            alt="Argumentation"
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

      {/* Main Form - ARGUMENTATION FINAL DRAFT */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
        {/* Argumentation Header with Icon and Help */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/argumentation01-circle-cmyk.jpg"
            alt="Argumentation"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            FINAL DRAFT
          </h2>
          <button
            onClick={() => setShowTipModal(true)}
            className="p-2 text-gray-500 hover:text-[#3d8c33] transition-colors"
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
                placeholder="A Little Leniency, Please!"
              />
            </div>
          </div>

          {/* Editable Final Paragraph */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              WRITE YOUR FINAL PARAGRAPH HERE (You can edit and revise as needed):
            </h3>
            
            {/* Editable Textarea */}
            <textarea
              value={finalDraftData.finalParagraph}
              onChange={(e) =>
                setFinalDraftData((prev) => ({
                  ...prev,
                  finalParagraph: e.target.value,
                }))
              }
              rows={12}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3d8c33] focus:border-[#3d8c33] text-gray-900 text-base leading-relaxed resize-none"
              placeholder="Type your complete final paragraph here. Include your topic sentence, concession/counterargument, refutation, concrete details, commentary, and concluding sentence..."
              style={{ textIndent: '2em' }}
            />
            
            {/* Color-Coded Display */}
            <div className="mt-4">
              <h4 className="text-md font-semibold text-gray-700 mb-2">Your Paragraph with Color Coding:</h4>
              <div className="p-4 border-2 border-gray-300 rounded-lg bg-white min-h-[200px]">
                <div className="text-base leading-relaxed" style={{ textIndent: '2em' }}>
                  {finalDraftData.finalParagraph ? (
                    <SafeHTML 
                      content={renderColorCodedParagraphHTML()} 
                      sanitizeLevel="educational"
                      fallback="Unable to display formatted content"
                    />
                  ) : (
                    <span className="text-gray-500 italic">Your color-coded paragraph will appear here as you type...</span>
                  )}
                </div>
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
            className="px-6 py-3 bg-[#13161f] text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors font-medium"
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
            className="px-6 py-3 bg-[#3d8c33] text-white rounded-lg hover:bg-[#2d6625] disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Submitting..." : "Submit Assignment"}
          </button>
        </div>
      </div>

      {/* Assignment Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Argumentation Assignment Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-[#3d8c33]">Final Draft</div>
            <div className="text-sm text-[#3d8c33]">Current Step</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">100%</div>
            <div className="text-sm text-blue-600">Estimated Progress</div>
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
                ARGUMENTATION FINAL DRAFT Tips
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
                <span className="font-semibold text-[#3d8c33]">1.</span> Read through your entire paragraph to ensure smooth flow between all elements.
              </div>

              <div>
                <span className="font-semibold text-[#3d8c33]">2.</span> Check that your topic sentence clearly states your position.
              </div>

              <div>
                <span className="font-semibold text-[#3d8c33]">3.</span> Verify that your concession and counterargument are fair and accurate.
              </div>

              <div>
                <span className="font-semibold text-[#3d8c33]">4.</span> Ensure your refutation effectively counters the opposing argument.
              </div>

              <div>
                <span className="font-semibold text-[#3d8c33]">5.</span> Confirm your concrete details provide strong evidence for your position.
              </div>

              <div>
                <span className="font-semibold text-[#3d8c33]">6.</span> Check that your commentary explains why your evidence supports your argument.
              </div>

              <div>
                <span className="font-semibold text-[#3d8c33]">7.</span> Use the color-coded preview to verify all sentence types are included and properly structured.
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowTipModal(false)}
                className="px-4 py-2 bg-[#3d8c33] text-white rounded-lg hover:bg-[#2d6625] transition-colors"
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
