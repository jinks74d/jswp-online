// components/dashboard/assignments/ArgumentationShapingSheetForm.tsx
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

interface ArgumentationShapingData {
  // Topic Sentence
  topicSentence: string;
  // Concession/Counterargument/Counterclaim
  concessionCounterargument: string;
  // Refutation
  refutation: string;
  // Concrete Details
  concreteDetails: string[];
  // Commentary
  commentarySentence: string;
  // Concluding Sentence
  concludingSentence: string;
}

interface ArgumentationShapingSheetFormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

export default function ArgumentationShapingSheetForm({
  assignment,
  studentProfile,
}: ArgumentationShapingSheetFormProps) {
  const router = useRouter();
  const [shapingData, setShapingData] = useState<ArgumentationShapingData>({
    topicSentence: "",
    concessionCounterargument: "",
    refutation: "",
    concreteDetails: [],
    commentarySentence: "",
    concludingSentence: "",
  });
  const [saving, setSaving] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved"
  >("idle");

  // Auto-save functionality with debouncing
  const debouncedAutoSave = useCallback(
    async (data: ArgumentationShapingData) => {
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
            concessionCounterargument: data.concessionCounterargument,
            refutation: data.refutation,
            concreteDetails: data.concreteDetails,
            commentarySentence: data.commentarySentence,
            concludingSentence: data.concludingSentence,
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
      if (
        shapingData.topicSentence.trim() ||
        shapingData.concessionCounterargument.trim() ||
        shapingData.refutation.trim() ||
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
              console.log("Loading Argumentation Shaping Sheet data:", stepData);

              // Load data from First Draft step (step5)
              let topicSentence = "";
              let concessionCounterargument = "";
              let refutation = "";
              let commentarySentence = "";
              let concludingSentence = "";
              let concreteDetails: string[] = [];

              // Load from step5 (First Draft)
              if (stepData.step5) {
                topicSentence = stepData.step5.revisedTopicSentence || "";
                concessionCounterargument = stepData.step5.concessionCounterargument || "";
                refutation = stepData.step5.refutation || "";
                commentarySentence = stepData.step5.commentarySentence || "";
                concludingSentence = stepData.step5.concludingSentence || "";
                concreteDetails = stepData.step5.selectedCDs || [];
              }

              // Always prioritize existing shaping sheet data if available
              setShapingData({
                topicSentence: stepData.shapingSheet?.topicSentence || topicSentence,
                concessionCounterargument: stepData.shapingSheet?.concessionCounterargument || concessionCounterargument,
                refutation: stepData.shapingSheet?.refutation || refutation,
                concreteDetails: stepData.shapingSheet?.concreteDetails || concreteDetails,
                commentarySentence: stepData.shapingSheet?.commentarySentence || commentarySentence,
                concludingSentence: stepData.shapingSheet?.concludingSentence || concludingSentence,
              });

              console.log("Loaded Argumentation Shaping Sheet data:", {
                topicSentence: stepData.shapingSheet?.topicSentence || topicSentence,
                concessionCounterargument: stepData.shapingSheet?.concessionCounterargument || concessionCounterargument,
                refutation: stepData.shapingSheet?.refutation || refutation,
                concreteDetails: stepData.shapingSheet?.concreteDetails || concreteDetails,
                commentarySentence: stepData.shapingSheet?.commentarySentence || commentarySentence,
                concludingSentence: stepData.shapingSheet?.concludingSentence || concludingSentence,
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
          concessionCounterargument: shapingData.concessionCounterargument,
          refutation: shapingData.refutation,
          concreteDetails: shapingData.concreteDetails,
          commentarySentence: shapingData.commentarySentence,
          concludingSentence: shapingData.concludingSentence,
        },
        status: "shaping_sheet",
        working_on: "shaping_sheet",
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

      alert(`✅ Argumentation shaping sheet saved successfully!`);
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
      shapingData.concessionCounterargument.trim().length > 0 &&
      shapingData.refutation.trim().length > 0 &&
      shapingData.concreteDetails.length > 0 &&
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
            href={`/dashboard/assignments/${assignment.id}/first-draft`}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to First Draft
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

      {/* Main Form - ARGUMENTATION SHAPING SHEET */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
        {/* Argumentation Header with Icon and Help */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/argumentation01-circle-cmyk.jpg"
            alt="Argumentation"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            THE SHAPING SHEET
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
                  rows={3}
                  className="w-full px-3 py-2 border-0 focus:outline-none text-blue-800 bg-transparent resize-none text-base"
                  placeholder="Enter your topic sentence here..."
                />
              </div>
            </div>
          </div>

          {/* Concession / Counterargument / Counterclaim */}
          <div className="text-center">
            <div className="inline-block">
              <div className="bg-black text-white px-8 py-3 rounded-t-lg font-bold text-lg">
                CONCESSION / COUNTERARGUMENT / COUNTERCLAIM
              </div>
              <div className="p-6 border-2 border-gray-600 rounded-b-lg bg-gray-50 min-w-[600px]">
                <textarea
                  value={shapingData.concessionCounterargument}
                  onChange={(e) =>
                    setShapingData((prev) => ({
                      ...prev,
                      concessionCounterargument: e.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full px-3 py-2 border-0 focus:outline-none text-gray-800 bg-transparent resize-none text-base"
                  placeholder="Enter your concession and counterargument here..."
                />
              </div>
            </div>
          </div>

          {/* Refutation */}
          <div className="text-center">
            <div className="inline-block">
              <div className="bg-black text-white px-8 py-3 rounded-t-lg font-bold text-lg">
                REFUTATION
              </div>
              <div className="p-6 border-2 border-gray-600 rounded-b-lg bg-gray-50 min-w-[600px]">
                <textarea
                  value={shapingData.refutation}
                  onChange={(e) =>
                    setShapingData((prev) => ({
                      ...prev,
                      refutation: e.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full px-3 py-2 border-0 focus:outline-none text-gray-800 bg-transparent resize-none text-base"
                  placeholder="Enter your refutation here..."
                />
              </div>
            </div>
          </div>

          {/* Concrete Details */}
          <div className="text-center">
            <div className="inline-block">
              <div className="bg-[#b3172c] text-white px-8 py-3 rounded-t-lg font-bold text-lg">
                CDs
              </div>
              {/* Display each concrete detail */}
              {shapingData.concreteDetails.map((cd, index) => (
                <div key={index} className="p-6 border-2 border-[#b3172c] bg-red-50 min-w-[600px] border-t-0">
                  <textarea
                    value={cd}
                    onChange={(e) => {
                      const newCDs = [...shapingData.concreteDetails];
                      newCDs[index] = e.target.value;
                      setShapingData((prev) => ({
                        ...prev,
                        concreteDetails: newCDs,
                      }));
                    }}
                    rows={3}
                    className="w-full px-3 py-2 border-0 focus:outline-none text-red-800 bg-transparent resize-none text-base"
                    placeholder={`Enter concrete detail ${index + 1} here...`}
                  />
                </div>
              ))}
              {/* Show placeholder if no CDs */}
              {shapingData.concreteDetails.length === 0 && (
                <div className="p-6 border-2 border-[#b3172c] rounded-b-lg bg-red-50 min-w-[600px] border-t-0">
                  <div className="text-red-600 text-center">
                    No concrete details loaded from previous steps
                  </div>
                </div>
              )}
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
                  rows={3}
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
            href={`/dashboard/assignments/${assignment.id}/first-draft`}
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
                router.push(
                  `/dashboard/assignments/${assignment.id}/final-draft`
                );
              } else if (!isComplete()) {
                alert("Please complete all required fields before continuing.");
              }
            }}
            disabled={saving || !isComplete()}
            className="px-6 py-3 bg-[#3d8c33] text-white rounded-lg hover:bg-[#2d6625] disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : "Save and Next"}
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
            <div className="text-2xl font-bold text-[#3d8c33]">
              Shaping Sheet
            </div>
            <div className="text-sm text-[#3d8c33]">Current Step</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">95%</div>
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
                ARGUMENTATION SHAPING SHEET Tips
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
                <span className="font-semibold text-[#3d8c33]">1.</span> Review
                and refine your topic sentence to clearly state your position.
              </div>

              <div>
                <span className="font-semibold text-[#3d8c33]">2.</span> Ensure
                your concession acknowledges the opposing view fairly.
              </div>

              <div>
                <span className="font-semibold text-[#3d8c33]">3.</span> Make
                your refutation strong and logical.
              </div>

              <div>
                <span className="font-semibold text-[#3d8c33]">4.</span> Check
                that your concrete details provide solid evidence for your
                argument.
              </div>

              <div>
                <span className="font-semibold text-[#3d8c33]">5.</span>{" "}
                Strengthen your commentary to explain why your evidence supports
                your position.
              </div>

              <div>
                <span className="font-semibold text-[#3d8c33]">6.</span> Ensure
                your concluding sentence reinforces your argument and provides
                closure.
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
