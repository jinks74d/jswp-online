// components/dashboard/assignments/ExpositoryWorkingTopicSentenceForm.tsx
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

interface ExpositoryWorkingTopicSentenceFormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

interface CDSection {
  cdText: string;
  cms: string[];
}

export default function ExpositoryWorkingTopicSentenceForm({
  assignment,
  studentProfile,
}: ExpositoryWorkingTopicSentenceFormProps) {
  const router = useRouter();
  const [workingTopicSentence, setWorkingTopicSentence] = useState("");
  const [cdSections, setCdSections] = useState<CDSection[]>([]);
  const [selectedChunks, setSelectedChunks] = useState(1);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Load previous step data and selected CDs
  useEffect(() => {
    const loadPreviousData = async () => {
      try {
        const response = await fetch(`/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`);
        const result = await response.json();
        
        if (response.ok && result.data) {
          // Load selectedChunks from previous step
          if (result.data.selected_chunks) {
            setSelectedChunks(result.data.selected_chunks);
          }
          
          // Load CD data and create sections for selected CDs
          if (result.data.concrete_details) {
            try {
              const cdData = JSON.parse(result.data.concrete_details);
              
              // Load existing working topic sentence
              if (cdData.workingTopicSentence) {
                setWorkingTopicSentence(cdData.workingTopicSentence);
              }

              // Check if cdSections with CM data already exists
              if (cdData.cdSections && cdData.cdSections.length > 0 && cdData.cdSections.some((s: CDSection) => s.cms.some(cm => cm.trim() !== ''))) {
                console.log("Loading existing cdSections with CM data:", cdData.cdSections);
                setCdSections(cdData.cdSections);
              } else {
                // If not, create the initial structure from selected CDs
                console.log("Creating initial cdSections structure from selected CDs.");
                const initialCdSections: CDSection[] = [];
                
                // Process Chunk 1
                if (cdData.chunk1CDs && cdData.selectedChunk1CDs) {
                  cdData.selectedChunk1CDs.forEach((index: number) => {
                    if (cdData.chunk1CDs[index]) {
                      initialCdSections.push({
                        cdText: cdData.chunk1CDs[index],
                        cms: Array(5).fill(""), // 5 empty CM fields
                      });
                    }
                  });
                }
                
                // Process Chunk 2
                if (cdData.selectedChunks === 2 && cdData.chunk2CDs && cdData.selectedChunk2CDs) {
                  cdData.selectedChunk2CDs.forEach((index: number) => {
                    if (cdData.chunk2CDs[index]) {
                      initialCdSections.push({
                        cdText: cdData.chunk2CDs[index],
                        cms: Array(5).fill(""), // 5 empty CM fields
                      });
                    }
                  });
                }
                setCdSections(initialCdSections);
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
          ...data,
          status: "working_topic_sentence",
          working_on: "step_2"
        };

        const response = await fetch('/api/student-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignment_id: assignment.id,
            student_id: studentProfile.id,
            concrete_details: JSON.stringify(mergedData),
            writing_style: "expository"
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
      if (workingTopicSentence.trim() || cdSections.some(section => section.cms.some(cm => cm.trim()))) {
        debouncedAutoSave({
          workingTopicSentence,
          cdSections
        });
      }
    }, 1000); // Auto-save after 1 second of inactivity

    return () => clearTimeout(timeoutId);
  }, [workingTopicSentence, cdSections, debouncedAutoSave]);

  const updateCM = (cdIndex: number, cmIndex: number, value: string) => {
    setCdSections(prev => {
      const updated = [...prev];
      updated[cdIndex].cms[cmIndex] = value;
      return updated;
    });
  };

  const addCM = (cdIndex: number) => {
    setCdSections(prev => {
      const updated = [...prev];
      updated[cdIndex].cms.push("");
      return updated;
    });
  };

  const removeCM = (cdIndex: number, cmIndex: number) => {
    setCdSections(prev => {
      const updated = [...prev];
      if (updated[cdIndex].cms.length > 3) { // Keep minimum of 3 CMs
        updated[cdIndex].cms.splice(cmIndex, 1);
      }
      return updated;
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
        workingTopicSentence,
        cdSections,
        status: "working_topic_sentence",
        working_on: "step_2"
      };

      const progressData = {
        assignment_id: assignment.id,
        student_id: studentProfile.id,
        concrete_details: JSON.stringify(mergedData),
        writing_style: "expository",
        status: "in_progress",
      };

      console.log("Saving Expository Working Topic Sentence:", progressData);

      // Call the API to save to database
      const response = await fetch('/api/student-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progressData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save progress');
      }

      alert(`✅ Expository Working Topic Sentence saved successfully!`);
      
    } catch (error) {
      console.error("Error saving Working Topic Sentence:", error);
      alert(`❌ Error saving: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndNext = async () => {
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

      // Merge with existing data to preserve previous steps and advance to next step
      const mergedData = {
        ...existingStepData,
        workingTopicSentence,
        cdSections,
        status: "commentary_development",
        working_on: "step_3" // Advance to Commentary Development step
      };

      const progressData = {
        assignment_id: assignment.id,
        student_id: studentProfile.id,
        concrete_details: JSON.stringify(mergedData),
        writing_style: "expository",
        status: "in_progress",
      };

      console.log("Saving and advancing to Commentary Development:", progressData);

      // Call the API to save to database
      const response = await fetch('/api/student-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progressData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save progress');
      }

      console.log("✅ Successfully advanced to Commentary Development step");
      
    } catch (error) {
      console.error("Error saving and advancing:", error);
      alert(`❌ Error saving: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
            href={`/dashboard/assignments/${assignment.id}/gathering-cds`}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Gathering CDs
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

      {/* Main Form - WORKING TOPIC SENTENCE */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
        {/* Expository Header with Icon */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/expository01-circle-cmyk.jpg"
            alt="Expository"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            EXPOSITORY
          </h2>
          
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
          {/* Prompt Section */}
          <div>
            <div className="w-full px-4 py-6 border border-gray-300 rounded-lg bg-[#8bb3ff] text-white text-center">
              <p className="text-sm uppercase tracking-wide">
                IN A ONE-CHUNK EXPOSITORY PARAGRAPH ({selectedChunks === 2 ? "2+:1" : "2+:1"}), DISCUSS SOME EFFECTIVE ADVICE
                YOU LEARNED ON STAYING HEALTHY DURING THE COLD AND FLU SEASON.
              </p>
            </div>
          </div>

          {/* Working Topic Sentence */}
          <div>
            <h3 className="text-lg font-semibold text-[#8bb3ff] mb-4 uppercase">
              Working Topic Sentence
            </h3>
            <textarea
              value={workingTopicSentence}
              onChange={(e) => setWorkingTopicSentence(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22356d] focus:border-[#22356d] text-gray-900 min-h-[100px] resize-y"
              placeholder="Enter your working topic sentence here..."
            />
          </div>

          {/* CD Sections */}
          {cdSections.map((cdSection, cdIndex) => (
            <div key={cdIndex} className="space-y-6">
              {/* Concrete Detail Header */}
              <div className="bg-[#b3172c] text-white p-4 rounded-lg">
                <h3 className="text-lg font-bold uppercase">
                  CONCRETE DETAIL #{cdIndex + 1}: {cdSection.cdText}
                </h3>
              </div>

              {/* CM Section */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                {/* Header */}
                <div className="text-center mb-6">
                  <h4 className="text-sm text-gray-600 uppercase">
                    CMs<br />
                    This CD was important because...Why?
                  </h4>
                </div>

                {/* CM Layout with Central Oval */}
                <div className="relative">
                  {/* Top Row */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <textarea
                      value={cdSection.cms[0] || ""}
                      onChange={(e) => updateCM(cdIndex, 0, e.target.value)}
                      className="w-full px-3 py-2 border-2 border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-900 text-sm min-h-[60px] resize-none"
                      placeholder="Enter Response"
                    />
                    <textarea
                      value={cdSection.cms[1] || ""}
                      onChange={(e) => updateCM(cdIndex, 1, e.target.value)}
                      className="w-full px-3 py-2 border-2 border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-900 text-sm min-h-[60px] resize-none"
                      placeholder="Enter Response"
                    />
                  </div>

                  {/* Central Oval - Positioned in the middle */}
                  <div className="flex justify-center mb-4">
                    <textarea
                      value={cdSection.cms[4] || ""}
                      onChange={(e) => updateCM(cdIndex, 4, e.target.value)}
                      className="w-48 px-4 py-2 border-2 border-green-500 rounded-full focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-900 text-sm min-h-[40px] resize-none text-center"
                      placeholder="Enter Response"
                    />
                  </div>

                  {/* Bottom Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <textarea
                      value={cdSection.cms[2] || ""}
                      onChange={(e) => updateCM(cdIndex, 2, e.target.value)}
                      className="w-full px-3 py-2 border-2 border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-900 text-sm min-h-[60px] resize-none"
                      placeholder="Enter Response"
                    />
                    <textarea
                      value={cdSection.cms[3] || ""}
                      onChange={(e) => updateCM(cdIndex, 3, e.target.value)}
                      className="w-full px-3 py-2 border-2 border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-900 text-sm min-h-[60px] resize-none"
                      placeholder="Enter Response"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-12">
          <Link
            href={`/dashboard/assignments/${assignment.id}/gathering-cds`}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Back
          </Link>

          <button
            onClick={async () => {
              await handleSaveAndNext();
              if (!saving) {
                // Navigate with step parameter to force Commentary Development form
                router.push(`/dashboard/assignments/${assignment.id}/commentary?step=3`);
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
              await handleSaveAndNext();
              if (!saving) {
                // Navigate with step parameter to force Commentary Development form
                router.push(`/dashboard/assignments/${assignment.id}/commentary?step=3`);
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
            <div className="text-2xl font-bold text-[#22356d]">Working Topic Sentence</div>
            <div className="text-sm text-[#22356d]">Current Step</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-[#3f8b31]">
              75%
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
    </div>
  );
}
