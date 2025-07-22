// components/dashboard/assignments/NarrativeShapingSheet3Form.tsx
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

interface NarrativeShapingSheet3Data {
  topicSentence: string;
  concreteDetails: string[];
  commentary: string;
  concludingSentence: string;
  assembledParagraph: string;
}

interface NarrativeShapingSheet3FormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

export default function NarrativeShapingSheet3Form({
  assignment,
  studentProfile,
}: NarrativeShapingSheet3FormProps) {
  const router = useRouter();
  const [shapingData, setShapingData] = useState<NarrativeShapingSheet3Data>({
    topicSentence: "",
    concreteDetails: [],
    commentary: "",
    concludingSentence: "",
    assembledParagraph: "",
  });
  const [saving, setSaving] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Auto-save functionality with debouncing
  const debouncedAutoSave = useCallback(
    async (data: NarrativeShapingSheet3Data) => {
      setAutoSaveStatus("saving");
      try {
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

        const mergedData = {
          ...existingStepData,
          shapingSheet3: {
            topicSentence: data.topicSentence,
            concreteDetails: data.concreteDetails,
            commentary: data.commentary,
            concludingSentence: data.concludingSentence,
            assembledParagraph: data.assembledParagraph,
          },
          status: "shaping_sheet_3",
          working_on: "shaping_sheet_3",
        };

        const response = await fetch("/api/student-progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignment_id: assignment.id,
            student_id: studentProfile.id,
            concrete_details: JSON.stringify(mergedData),
            writing_style: "narrative",
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

  // Auto-assemble paragraph when data changes
  const assembleColorCodedParagraph = useCallback((data: NarrativeShapingSheet3Data) => {
    const parts = [];
    
    if (data.topicSentence.trim()) {
      parts.push(`<span style="color: #2563eb; font-weight: 600;">${data.topicSentence.trim()}</span>`);
    }
    
    data.concreteDetails.forEach(cd => {
      if (cd.trim()) {
        parts.push(`<span style="color: #dc2626; font-weight: 600;">${cd.trim()}</span>`);
      }
    });
    
    if (data.commentary.trim()) {
      parts.push(`<span style="color: #16a34a; font-weight: 600;">${data.commentary.trim()}</span>`);
    }
    
    if (data.concludingSentence.trim()) {
      parts.push(`<span style="color: #2563eb; font-weight: 600;">${data.concludingSentence.trim()}</span>`);
    }
    
    return parts.join(' ');
  }, []);

  // Auto-save when data changes
  useEffect(() => {
    const assembledParagraph = assembleColorCodedParagraph(shapingData);
    const updatedData = { ...shapingData, assembledParagraph };
    
    if (JSON.stringify(updatedData) !== JSON.stringify(shapingData)) {
      setShapingData(updatedData);
    }

    const timeoutId = setTimeout(() => {
      if (
        shapingData.topicSentence.trim() ||
        shapingData.concreteDetails.length > 0 ||
        shapingData.commentary.trim() ||
        shapingData.concludingSentence.trim()
      ) {
        debouncedAutoSave(updatedData);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [shapingData.topicSentence, shapingData.concreteDetails, shapingData.commentary, shapingData.concludingSentence, debouncedAutoSave, assembleColorCodedParagraph]);

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
              console.log("Loading Narrative Shaping Sheet 3 data:", stepData);

              // Load data from T-Chart 3
              let topicSentence = "";
              let concreteDetails: string[] = [];
              let commentary = "";
              let concludingSentence = "";

              if (stepData.tChart3) {
                const tChart3 = stepData.tChart3;
                topicSentence = tChart3.topicSentence || "";
                
                if (tChart3.tChartData) {
                  const data = tChart3.tChartData;
                  const cds = [];
                  if (data.when_cd) cds.push(data.when_cd);
                  if (data.where_cd) cds.push(data.where_cd);
                  if (data.who_cd) cds.push(data.who_cd);
                  if (data.what_cd) cds.push(data.what_cd);
                  if (data.dialogue_cd) cds.push(data.dialogue_cd);
                  concreteDetails = cds.filter(cd => cd.trim());

                  const cms = [];
                  if (data.when_cm) cms.push(data.when_cm);
                  if (data.where_cm) cms.push(data.where_cm);
                  if (data.who_cm) cms.push(data.who_cm);
                  if (data.what_cm) cms.push(data.what_cm);
                  if (data.dialogue_cm) cms.push(data.dialogue_cm);
                  commentary = cms.filter(cm => cm.trim()).join(" ");
                }
              }

              // Prioritize existing shaping sheet data if available
              const loadedData = {
                topicSentence: stepData.shapingSheet3?.topicSentence || topicSentence,
                concreteDetails: stepData.shapingSheet3?.concreteDetails || concreteDetails,
                commentary: stepData.shapingSheet3?.commentary || commentary,
                concludingSentence: stepData.shapingSheet3?.concludingSentence || concludingSentence,
                assembledParagraph: stepData.shapingSheet3?.assembledParagraph || "",
              };

              setShapingData(loadedData);
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
      await debouncedAutoSave(shapingData);
      alert(`✅ Body Paragraph 3 shaping sheet saved successfully!`);
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

  const isComplete = () => {
    return (
      shapingData.topicSentence.trim().length > 0 &&
      shapingData.concreteDetails.length > 0 &&
      shapingData.commentary.trim().length > 0 &&
      shapingData.concludingSentence.trim().length > 0
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/assignments/${assignment.id}/body-paragraphs`}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to T-Chart 3
          </Link>
        </div>

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
            src="/assets/narrative01-circle-cmyk.jpg"
            alt="Narrative"
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

        <div className="p-4 bg-[#13161f] rounded-lg text-white">
          <h3 className="font-medium mb-2">Narrative Prompt</h3>
          <p>{assignment.prompt || "No prompt provided"}</p>
        </div>
      </div>

      {/* Main Form - SHAPING SHEET FOR BODY PARAGRAPH 3 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/narrative01-circle-cmyk.jpg"
            alt="Narrative"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            SHAPING SHEET FOR BODY PARAGRAPH 3
          </h2>
          <button
            onClick={() => setShowTipModal(true)}
            className="p-2 text-gray-500 hover:text-[#13161f] transition-colors"
            title="Show tips"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side - Form */}
          <div className="space-y-6">
            {/* Topic Sentence */}
            <div>
              <div className="bg-blue-600 text-white px-4 py-2 rounded-t-lg font-bold text-sm">
                TS
              </div>
              <div className="border-2 border-blue-600 rounded-b-lg p-4 bg-blue-50">
                <textarea
                  value={shapingData.topicSentence}
                  onChange={(e) =>
                    setShapingData((prev) => ({
                      ...prev,
                      topicSentence: e.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full px-3 py-2 border-0 focus:outline-none text-blue-800 bg-transparent resize-none"
                  placeholder="Topic sentence from T-Chart 3..."
                />
              </div>
            </div>

            {/* Concrete Details */}
            <div>
              <div className="bg-[#b3172c] text-white px-4 py-2 rounded-t-lg font-bold text-sm">
                CDs
              </div>
              {shapingData.concreteDetails.map((cd, index) => (
                <div
                  key={index}
                  className="border-2 border-[#b3172c] bg-red-50 p-4 border-t-0"
                >
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
                    rows={2}
                    className="w-full px-3 py-2 border-0 focus:outline-none text-red-800 bg-transparent resize-none"
                    placeholder={`Concrete detail ${index + 1}...`}
                  />
                </div>
              ))}
              {shapingData.concreteDetails.length === 0 && (
                <div className="border-2 border-[#b3172c] rounded-b-lg bg-red-50 p-4 border-t-0">
                  <div className="text-red-600 text-center">
                    No concrete details loaded from T-Chart 3
                  </div>
                </div>
              )}
            </div>

            {/* Commentary */}
            <div>
              <div className="bg-green-600 text-white px-4 py-2 rounded-t-lg font-bold text-sm">
                CMs
              </div>
              <div className="border-2 border-green-600 rounded-b-lg p-4 bg-green-50">
                <textarea
                  value={shapingData.commentary}
                  onChange={(e) =>
                    setShapingData((prev) => ({
                      ...prev,
                      commentary: e.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full px-3 py-2 border-0 focus:outline-none text-green-800 bg-transparent resize-none"
                  placeholder="Commentary from T-Chart 3..."
                />
              </div>
            </div>

            {/* Concluding Sentence */}
            <div>
              <div className="bg-blue-600 text-white px-4 py-2 rounded-t-lg font-bold text-sm">
                CS
              </div>
              <div className="border-2 border-blue-600 rounded-b-lg p-4 bg-blue-50">
                <textarea
                  value={shapingData.concludingSentence}
                  onChange={(e) =>
                    setShapingData((prev) => ({
                      ...prev,
                      concludingSentence: e.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full px-3 py-2 border-0 focus:outline-none text-blue-800 bg-transparent resize-none"
                  placeholder="Concluding sentence for body paragraph 3..."
                />
              </div>
            </div>
          </div>

          {/* Right Side - Color-coded Paragraph Preview */}
          <div className="space-y-4">
            <div className="bg-gray-100 text-gray-800 px-4 py-2 rounded-t-lg font-bold text-sm">
              Shaping Sheet 3
            </div>
            <div className="border-2 border-gray-400 rounded-b-lg p-6 bg-white min-h-[500px]">
              <div
                className="prose max-w-none leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: shapingData.assembledParagraph || "Your paragraph will appear here as you fill in the form..."
                }}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-8">
          <Link
            href={`/dashboard/assignments/${assignment.id}/body-paragraphs`}
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
                router.push(`/dashboard/assignments/${assignment.id}/final-draft`);
              } else if (!isComplete()) {
                alert("Please complete all required fields before continuing.");
              }
            }}
            disabled={saving || !isComplete()}
            className="px-6 py-3 bg-[#13161f] text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : "Save and Continue to Final Draft"}
          </button>
        </div>
      </div>

      {/* Tip Modal */}
      {showTipModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                BODY PARAGRAPH 3 SHAPING SHEET Tips
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
                <span className="font-semibold text-[#13161f]">1.</span> This is your final body paragraph - make it strong and conclusive.
              </div>
              <div>
                <span className="font-semibold text-[#13161f]">2.</span> Your concrete details should focus on the ending of your narrative.
              </div>
              <div>
                <span className="font-semibold text-[#13161f]">3.</span> Commentary should reflect on the overall significance of your story.
              </div>
              <div>
                <span className="font-semibold text-[#13161f]">4.</span> The concluding sentence should transition smoothly to your conclusion.
              </div>
              <div>
                <span className="font-semibold text-[#13161f]">5.</span> This paragraph should bring closure to your narrative journey!
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowTipModal(false)}
                className="px-4 py-2 bg-[#13161f] text-white rounded-lg hover:bg-gray-700 transition-colors"
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
