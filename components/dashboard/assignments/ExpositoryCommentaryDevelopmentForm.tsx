// components/dashboard/assignments/ExpositoryCommentaryDevelopmentForm.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Printer } from "lucide-react";
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

interface ExpositoryCommentaryDevelopmentFormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

interface CDSection {
  cdText: string;
  cms: string[];
  selectedCMs: number[];
}

export default function ExpositoryCommentaryDevelopmentForm({
  assignment,
  studentProfile,
}: ExpositoryCommentaryDevelopmentFormProps) {
  const router = useRouter();
  const [workingTopicSentence, setWorkingTopicSentence] = useState("");
  const [revisedTopicSentence, setRevisedTopicSentence] = useState("");
  const [commentarySentence, setCommentarySentence] = useState("");
  const [concludingSentence, setConcludingSentence] = useState("");
  const [cdSections, setCdSections] = useState<CDSection[]>([]);
  const [selectedChunks, setSelectedChunks] = useState(1);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved"
  >("idle");

  // Load previous step data
  useEffect(() => {
    const loadPreviousData = async () => {
      try {
        const response = await fetch(
          `/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`
        );
        const result = await response.json();

        if (response.ok && result.data) {
          // Load selectedChunks from previous step
          if (result.data.selected_chunks) {
            setSelectedChunks(result.data.selected_chunks);
          }

          // Load data from previous steps
          if (result.data.concrete_details) {
            try {
              const cdData = JSON.parse(result.data.concrete_details);
              console.log("Commentary Development - Loading data:", cdData);

              // Load working topic sentence from previous step
              if (cdData.workingTopicSentence) {
                setWorkingTopicSentence(cdData.workingTopicSentence);
                // Initialize revised topic sentence with working topic sentence
                if (!cdData.revisedTopicSentence) {
                  setRevisedTopicSentence(cdData.workingTopicSentence);
                }
              }

              // Load CD sections with CMs from previous step
              if (cdData.cdSections && Array.isArray(cdData.cdSections)) {
                console.log("Found cdSections:", cdData.cdSections);

                // Map the sections and ensure the cms and selectedCMs arrays are initialized
                const sectionsWithData = cdData.cdSections.map(
                  (section: any) => ({
                    ...section,
                    cms: section.cms || Array(5).fill(""),
                    selectedCMs: section.selectedCMs || [],
                  })
                );

                console.log(
                  "Loaded cdSections with CM data:",
                  sectionsWithData
                );
                setCdSections(sectionsWithData);
              } else {
                console.log("No cdSections found, creating from selected CDs");
                // If no cdSections, create them from the selected CDs with sample CMs
                const selectedCDs: CDSection[] = [];

                // Add selected CDs from chunk 1
                if (cdData.chunk1CDs && cdData.selectedChunk1CDs) {
                  cdData.selectedChunk1CDs.forEach((index: number) => {
                    if (cdData.chunk1CDs[index]) {
                      const cdText = cdData.chunk1CDs[index];
                      let sampleCMs = ["", "", "", "", ""];

                      // Provide sample CMs based on CD text
                      if (cdText.toLowerCase().includes("sleep")) {
                        sampleCMs = [
                          "energizing",
                          "excellent health",
                          "sense of well-being",
                          "strong immune system",
                          "body is rested; less stress",
                        ];
                      } else if (
                        cdText.toLowerCase().includes("food") ||
                        cdText.toLowerCase().includes("eat")
                      ) {
                        sampleCMs = [
                          "wards off illness",
                          "fresh and organic",
                          "healthy choices",
                          "sensible",
                          "feel better",
                        ];
                      } else {
                        sampleCMs = [
                          "beneficial",
                          "important",
                          "effective",
                          "helpful",
                          "valuable",
                        ];
                      }

                      selectedCDs.push({
                        cdText: cdText,
                        cms: sampleCMs,
                        selectedCMs: [],
                      });
                    }
                  });
                }

                // Add selected CDs from chunk 2 if applicable
                if (
                  cdData.selectedChunks === 2 &&
                  cdData.chunk2CDs &&
                  cdData.selectedChunk2CDs
                ) {
                  cdData.selectedChunk2CDs.forEach((index: number) => {
                    if (cdData.chunk2CDs[index]) {
                      selectedCDs.push({
                        cdText: cdData.chunk2CDs[index],
                        cms: [
                          "beneficial",
                          "important",
                          "effective",
                          "helpful",
                          "valuable",
                        ],
                        selectedCMs: [],
                      });
                    }
                  });
                }

                console.log(
                  "Created selectedCDs with sample CMs:",
                  selectedCDs
                );
                setCdSections(selectedCDs);
              }

              // Load existing commentary development data if returning to this step
              if (cdData.revisedTopicSentence) {
                setRevisedTopicSentence(cdData.revisedTopicSentence);
              }
              if (cdData.commentarySentence) {
                setCommentarySentence(cdData.commentarySentence);
              }
              if (cdData.concludingSentence) {
                setConcludingSentence(cdData.concludingSentence);
              }
            } catch (error) {
              console.log("Error parsing CD data:", error);
            }
          }
        }
      } catch (error) {
        console.error("Error loading previous data:", error);
      }
    };

    loadPreviousData();
  }, [assignment.id, studentProfile.id]);

  // Auto-save functionality with debouncing
  const debouncedAutoSave = useCallback(
    async (data: any) => {
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
          ...data,
          status: "commentary_development",
          working_on: "step_3",
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

  // Auto-save when data changes (but not when cdSections selection changes to prevent conflicts)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (
        revisedTopicSentence.trim() ||
        commentarySentence.trim() ||
        concludingSentence.trim()
      ) {
        debouncedAutoSave({
          workingTopicSentence,
          revisedTopicSentence,
          commentarySentence,
          concludingSentence,
          cdSections,
        });
      }
    }, 1000); // Auto-save after 1 second of inactivity

    return () => clearTimeout(timeoutId);
  }, [
    workingTopicSentence,
    revisedTopicSentence,
    commentarySentence,
    concludingSentence,
    debouncedAutoSave,
  ]);

  const toggleCMSelection = (cdIndex: number, cmIndex: number) => {
    console.log(`Toggling CM: CD ${cdIndex}, CM ${cmIndex}`);
    
    setCdSections((prev) => {
      const updated = [...prev];
      const selectedCMs = updated[cdIndex].selectedCMs || [];

      if (selectedCMs.includes(cmIndex)) {
        // Remove if already selected
        updated[cdIndex].selectedCMs = selectedCMs.filter(
          (index) => index !== cmIndex
        );
        console.log(`Removed CM ${cmIndex}, new selection:`, updated[cdIndex].selectedCMs);
      } else {
        // Add if not selected
        updated[cdIndex].selectedCMs = [...selectedCMs, cmIndex];
        console.log(`Added CM ${cmIndex}, new selection:`, updated[cdIndex].selectedCMs);
      }

      return updated;
    });
  };

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
        workingTopicSentence,
        revisedTopicSentence,
        commentarySentence,
        concludingSentence,
        cdSections,
        status: "commentary_development",
        working_on: "step_3",
      };

      const progressData = {
        assignment_id: assignment.id,
        student_id: studentProfile.id,
        concrete_details: JSON.stringify(mergedData),
        writing_style: "expository",
        status: "in_progress",
      };

      console.log("Saving Expository Commentary Development:", progressData);

      // Call the API to save to database
      const response = await fetch("/api/student-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(progressData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save progress");
      }

      alert(`✅ Expository Commentary Development saved successfully!`);
    } catch (error) {
      console.error("Error saving Commentary Development:", error);
      alert(
        `❌ Error saving: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setSaving(false);
    }
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
            href={`/dashboard/assignments/${assignment.id}/commentary`}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Working Topic Sentence
          </Link>
        </div>

        {/* Print and Due Date */}
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
            <Printer className="w-5 h-5" />
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

      {/* Main Form - COMMENTARY DEVELOPMENT */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
        {/* Expository Header with Icon */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/expository01-circle-cmyk.jpg"
            alt="Expository"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">EXPOSITORY</h2>

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

        {/* Commentary Development Title */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-2 uppercase">
            COMMENTARY DEVELOPMENT
          </h3>
          <h4 className="text-sm font-semibold text-gray-700 uppercase">
            PROMPT:
          </h4>
        </div>

        {/* Form Content */}
        <div className="space-y-8">
          {/* Prompt Section */}
          <div>
            <div className="w-full px-4 py-6 border border-gray-300 rounded-lg bg-[#8bb3ff] text-white text-center">
              <p className="text-sm uppercase tracking-wide">
                IN A ONE-CHUNK EXPOSITORY PARAGRAPH (
                {selectedChunks === 2 ? "2+:1" : "2+:1"}), DISCUSS SOME
                EFFECTIVE ADVICE YOU LEARNED ON STAYING HEALTHY DURING THE COLD
                AND FLU SEASON.
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <p className="text-sm text-gray-700 uppercase mb-4">
              IT'S TIME TO REVISE YOUR TOPIC SENTENCE, DETERMINE YOUR COMMENTARY
              SENTENCE(S), AND COMPLETE YOUR PARAGRAPH WITH A CONCLUDING
              SENTENCE
            </p>
          </div>

          {/* Working Topic Sentence */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase">
              WORKING TOPIC SENTENCE:
            </h4>
            <div className="bg-gray-100 p-4 rounded-lg">
              <p className="text-gray-700 italic">{workingTopicSentence}</p>
            </div>
          </div>

          {/* Revised Topic Sentence */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase">
              REVISED TOPIC SENTENCE
            </h4>
            <ul className="text-xs text-gray-600 mb-4 space-y-1">
              <li>• Review the CMs under each CD.</li>
              <li>• Look for OVERARCHING CMs to REVISE YOUR TOPIC SENTENCE.</li>
              <li>
                • HIGHLIGHT the ones you choose, so you do not use them again --
                "When you use it, you lose it."
              </li>
            </ul>
            <textarea
              value={revisedTopicSentence}
              onChange={(e) => setRevisedTopicSentence(e.target.value)}
              className="w-full px-4 py-3 border-2 border-[#8bb3ff] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22356d] focus:border-[#22356d] text-gray-900 min-h-[80px] resize-y"
              placeholder="Effective advice is available to stay healthy during the cold and flu season."
            />
          </div>

          {/* CD Sections with CM Selection */}
          {cdSections.map((cdSection, cdIndex) => (
            <div key={cdIndex} className="space-y-4">
              {/* Concrete Detail Header */}
              <div className="bg-[#b3172c] text-white p-3 rounded-lg">
                <h3 className="text-sm font-bold uppercase">
                  {cdSection.cdText}
                </h3>
              </div>

              {/* CM Selection Grid - All 5 CMs in 2-column layout */}
              <div className="grid grid-cols-2 gap-3">
                {cdSection.cms.slice(0, 5).map((cm, cmIndex) => {
                  const isSelected = cdSection.selectedCMs.includes(cmIndex);
                  
                  return (
                    <button
                      key={`${cdIndex}-${cmIndex}`}
                      onClick={() => toggleCMSelection(cdIndex, cmIndex)}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        textAlign: 'center',
                        fontSize: '16px',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '64px',
                        cursor: 'pointer',
                        border: '2px solid',
                        backgroundColor: isSelected ? '#bbf7d0' : '#16a34a',
                        color: isSelected ? '#1f2937' : '#ffffff',
                        borderColor: isSelected ? '#4ade80' : '#16a34a',
                        transition: 'all 0.2s ease',
                        minHeight: '64px'
                      }}
                    >
                      {cm || ""}{isSelected ? " ✓" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Commentary Sentence */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase">
              WRITE YOUR COMMENTARY SENTENCE:
            </h4>
            <ol className="text-xs text-gray-600 mb-4 space-y-1">
              <li>1. Select CMs that apply to the CDs representing Chunk 1.</li>
              <li>
                2. "Pick-n-Stitch" the selected CMs to create your Commentary
                Sentence.
              </li>
              <li>
                3. Hint: Be sure to reserve your strongest CM for your
                Concluding Sentence.
              </li>
              <li>
                4. Highlight the ones you use. "When you use it, you lose it."
              </li>
            </ol>
            <textarea
              value={commentarySentence}
              onChange={(e) => setCommentarySentence(e.target.value)}
              className="w-full px-4 py-3 border-2 border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-900 min-h-[100px] resize-y"
              placeholder="Write your commentary sentence here..."
            />
          </div>

          {/* Concluding Sentence */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase">
              WRITE YOUR CONCLUDING SENTENCE:
            </h4>
            <ul className="text-xs text-gray-600 mb-4 space-y-1">
              <li>
                • Your Concluding Sentence is the last sentence your reader will
                see in this paragraph.
              </li>
              <li>
                • Select remaining CMs that give a finished feeling to the
                paragraph.
              </li>
              <li>
                • Highlight the ones you use. "When you use it, you lose it."
              </li>
            </ul>
            <textarea
              value={concludingSentence}
              onChange={(e) => setConcludingSentence(e.target.value)}
              className="w-full px-4 py-3 border-2 border-[#8bb3ff] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22356d] focus:border-[#22356d] text-gray-900 min-h-[100px] resize-y"
              placeholder="Write your concluding sentence here..."
            />
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
            onClick={async () => {
              await handleSave();
              if (!saving) {
                router.push(
                  `/dashboard/assignments/${assignment.id}/shaping`
                );
              }
            }}
            disabled={saving}
            className="px-6 py-3 bg-[#4dd0e1] text-white rounded-lg hover:bg-[#26c6da] disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : "Next"}
          </button>

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
              if (!saving) {
                router.push(
                  `/dashboard/assignments/${assignment.id}/shaping`
                );
              }
            }}
            disabled={saving}
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
            <div className="text-2xl font-bold text-[#22356d]">
              Commentary Development
            </div>
            <div className="text-sm text-[#22356d]">Current Step</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-[#3f8b31]">90%</div>
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
    </div>
  );
}
