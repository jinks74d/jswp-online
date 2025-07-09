// components/dashboard/assignments/ArgumentationFirstDraftForm.tsx
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

interface ArgumentationFirstDraftFormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

export default function ArgumentationFirstDraftForm({
  assignment,
  studentProfile,
}: ArgumentationFirstDraftFormProps) {
  const router = useRouter();
  const [revisedTopicSentence, setRevisedTopicSentence] = useState("");
  const [concessionCounterargument, setConcessionCounterargument] = useState("");
  const [refutation, setRefutation] = useState("");
  const [selectedCDs, setSelectedCDs] = useState<string[]>([]);
  const [commentarySentence, setCommentarySentence] = useState("");
  const [concludingSentence, setConcludingSentence] = useState("");
  const [commentaryData, setCommentaryData] = useState<{[key: string]: string}>({});
  const [selectedCommentaryWords, setSelectedCommentaryWords] = useState<string[]>([]);
  const [cdMapping, setCdMapping] = useState<Array<{cd: string, chunk: number, originalIndex: number}>>([]);
  const [saving, setSaving] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Auto-save functionality with debouncing
  const debouncedAutoSave = useCallback(
    async (data: {
      revisedTopicSentence: string;
      concessionCounterargument: string;
      refutation: string;
      selectedCDs: string[];
      commentarySentence: string;
      concludingSentence: string;
    }) => {
      setAutoSaveStatus('saving');
      try {
        // First get existing data to preserve previous steps
        const existingResponse = await fetch(`/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`);
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
          step4: {
            revisedTopicSentence: data.revisedTopicSentence,
            concessionCounterargument: data.concessionCounterargument,
            refutation: data.refutation,
            selectedCDs: data.selectedCDs,
            commentarySentence: data.commentarySentence,
            concludingSentence: data.concludingSentence,
          },
          step5: {
            revisedTopicSentence: data.revisedTopicSentence,
            concessionCounterargument: data.concessionCounterargument,
            refutation: data.refutation,
            selectedCDs: data.selectedCDs,
            commentarySentence: data.commentarySentence,
            concludingSentence: data.concludingSentence,
          },
          status: "first_draft",
          working_on: "step_4"
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
      if (revisedTopicSentence.trim() || concessionCounterargument.trim() || refutation.trim()) {
        debouncedAutoSave({
          revisedTopicSentence,
          concessionCounterargument,
          refutation,
          selectedCDs,
          commentarySentence,
          concludingSentence
        });
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [revisedTopicSentence, concessionCounterargument, refutation, selectedCDs, commentarySentence, concludingSentence, debouncedAutoSave]);

  // Load previous step data on component mount
  useEffect(() => {
    const loadPreviousData = async () => {
      try {
        const response = await fetch(`/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`);
        const result = await response.json();
        
        if (response.ok && result.data?.concrete_details) {
          try {
            const stepData = JSON.parse(result.data.concrete_details);
            
            // Load working topic sentence from step 3
            if (stepData.workingTopicSentence) {
              setRevisedTopicSentence(stepData.workingTopicSentence);
            }
            
            // Load T-Chart data for concession/counterargument/refutation from step 2
            if (stepData.tChartData) {
              const positiveRows = stepData.tChartData.positiveRows || [];
              const negativeRows = stepData.tChartData.negativeRows || [];
              
              // Find concession and counterargument
              const concessionRow = [...positiveRows, ...negativeRows].find(row => row.isC);
              const counterargumentRow = [...positiveRows, ...negativeRows].find(row => row.isCA);
              const refutationRow = [...positiveRows, ...negativeRows].find(row => row.isR);
              
              if (concessionRow && counterargumentRow) {
                setConcessionCounterargument(`${concessionRow.reason} However, ${counterargumentRow.reason}`);
              }
              
              if (refutationRow) {
                setRefutation(refutationRow.reason);
              }
            }
            
            // Load selected CDs from step 1 with mapping info
            const cds: string[] = [];
            const cdToChunkMapping: Array<{cd: string, chunk: number, originalIndex: number}> = [];
            
            if (stepData.chunk1CDs && stepData.selectedChunk1CDs) {
              stepData.selectedChunk1CDs.forEach((index: number) => {
                if (stepData.chunk1CDs[index]) {
                  cds.push(stepData.chunk1CDs[index]);
                  cdToChunkMapping.push({
                    cd: stepData.chunk1CDs[index],
                    chunk: 1,
                    originalIndex: index
                  });
                }
              });
            }
            if (stepData.chunk2CDs && stepData.selectedChunk2CDs) {
              stepData.selectedChunk2CDs.forEach((index: number) => {
                if (stepData.chunk2CDs[index]) {
                  cds.push(stepData.chunk2CDs[index]);
                  cdToChunkMapping.push({
                    cd: stepData.chunk2CDs[index],
                    chunk: 2,
                    originalIndex: index
                  });
                }
              });
            }
            setSelectedCDs(cds);
            
            // Store the mapping for commentary lookup
            setCdMapping(cdToChunkMapping);
            
            // Load commentary data from step 3 (working topic sentence)
            if (stepData.commentaryData) {
              setCommentaryData(stepData.commentaryData);
            }
            
            // Load first draft data if returning to this step
            if (stepData.step5) {
              setRevisedTopicSentence(stepData.step5.revisedTopicSentence || revisedTopicSentence);
              setConcessionCounterargument(stepData.step5.concessionCounterargument || concessionCounterargument);
              setRefutation(stepData.step5.refutation || refutation);
              setCommentarySentence(stepData.step5.commentarySentence || "");
              setConcludingSentence(stepData.step5.concludingSentence || "");
              setSelectedCommentaryWords(stepData.step5.selectedCommentaryWords || []);
            }
          } catch {
            console.log("No existing data to load");
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
      const existingResponse = await fetch(`/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`);
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
        step5: {
          revisedTopicSentence,
          concessionCounterargument,
          refutation,
          selectedCDs,
          commentarySentence,
          concludingSentence,
        },
        status: "first_draft",
        working_on: "step_5"
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

      alert(`✅ First draft saved successfully!`);
      
    } catch (error) {
      console.error("Error saving first draft:", error);
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

  // Handle commentary word selection
  const toggleCommentaryWordSelection = (word: string) => {
    setSelectedCommentaryWords(prev => 
      prev.includes(word)
        ? prev.filter(w => w !== word)
        : [...prev, word]
    );
  };

  const canProceed = () => {
    return revisedTopicSentence.trim().length > 0 && 
           concessionCounterargument.trim().length > 0 && 
           refutation.trim().length > 0 &&
           commentarySentence.trim().length > 0 &&
           concludingSentence.trim().length > 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/assignments/${assignment.id}/working-topic-sentence`}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Working Topic Sentence
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

      {/* Main Form - ARGUMENTATION FIRST DRAFT */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
        {/* Argumentation Header with Icon and Help */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/argumentation01-circle-cmyk.jpg"
            alt="Argumentation"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            ARGUMENTATION FIRST DRAFT
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
          {/* Revised Topic Sentence */}
          <div>
            <h3 className="text-lg font-semibold text-blue-600 mb-4 uppercase">
              Revised Topic Sentence
            </h3>
            <textarea
              value={revisedTopicSentence}
              onChange={(e) => setRevisedTopicSentence(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-blue-50"
              placeholder="Revise and improve your topic sentence from the previous step..."
            />
          </div>

          {/* Concession / Counterargument / Counterclaim */}
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-4 uppercase">
              Concession / Counterargument / Counterclaim
            </h3>
            <textarea
              value={concessionCounterargument}
              onChange={(e) => setConcessionCounterargument(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-900 bg-gray-50"
              placeholder="State what both sides might agree on, then present the opposing argument..."
            />
            <p className="text-sm text-gray-600 mt-2">
              Start with what both sides agree on (concession), then present the strongest opposing argument (counterargument).
            </p>
          </div>

          {/* Refutation */}
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-4 uppercase">
              Refutation
            </h3>
            <textarea
              value={refutation}
              onChange={(e) => setRefutation(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-900 bg-gray-50"
              placeholder="Explain why the counterargument is wrong or insufficient..."
            />
            <p className="text-sm text-gray-600 mt-2">
              This should directly address and refute the counterargument you stated above.
            </p>
          </div>

          {/* Selected CDs Display with Interactive Commentary Selection */}
          {selectedCDs.length > 0 && (
            <div className="space-y-8">
              {selectedCDs.map((cd, index) => (
                <div key={index} className="space-y-4">
                  {/* CD Display */}
                  <div className="bg-red-50 p-6 rounded-lg border-2 border-red-500">
                    <div className="flex items-start gap-3 mb-4">
                      <span className="bg-red-600 text-white text-sm font-bold px-2 py-1 rounded">
                        CD #{index + 1}
                      </span>
                      <p className="text-red-800 font-medium">{cd}</p>
                    </div>
                  </div>

                  {/* Commentary Words Grid - Interactive Selection */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-gray-800">
                      SELECT COMMENTARY WORDS/PHRASES FOR CD #{index + 1}:
                    </h4>
                    
                    {/* Show only the 5 CMs for this specific CD from working topic sentence step */}
                    <div className="grid grid-cols-2 gap-4">
                      {Array.from({length: 5}).map((_, cmIndex) => {
                        // Find the correct mapping for this CD
                        const mapping = cdMapping.find(m => m.cd === cd);
                        
                        if (!mapping) {
                          return (
                            <div key={cmIndex} className="p-3 border border-gray-300 rounded text-center bg-gray-100 text-gray-400">
                              <span className="text-sm">No mapping found</span>
                            </div>
                          );
                        }
                        
                        // Use the correct chunk and original index from the mapping
                        const cdKey = `chunk${mapping.chunk}-${mapping.originalIndex}`;
                        const cmKey = `${cdKey}-${cmIndex + 1}`;
                        const commentaryValue = commentaryData[cmKey] || '';
                        
                        if (!commentaryValue.trim()) return (
                          <div key={cmIndex} className="p-3 border border-gray-300 rounded text-center bg-gray-100 text-gray-400">
                            <span className="text-sm">No CM entered</span>
                          </div>
                        );
                        
                        const isSelected = selectedCommentaryWords.includes(commentaryValue);
                        
                        return (
                          <button
                            key={cmIndex}
                            onClick={() => toggleCommentaryWordSelection(commentaryValue)}
                            className={`p-3 border border-green-300 rounded text-center cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-green-100 text-green-800"
                                : "bg-green-600 text-white hover:bg-green-700"
                            }`}
                          >
                            <span className="font-medium">{commentaryValue}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Commentary Sentence */}
          <div>
            <h3 className="text-lg font-semibold text-green-600 mb-4 uppercase">
              Write Your Commentary Sentence
            </h3>
            <div className="mb-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-300 mb-4">
                <p className="text-green-800 font-medium">
                  Select CMs that apply to the CDs representing Chunk 1:
                </p>
                <ol className="list-decimal list-inside mt-2 text-green-700 text-sm">
                  <li>"Pick-n-Stitch" the selected CMs to create your Commentary Sentence.</li>
                  <li>Hint: Be sure to reserve your strongest CM for your Concluding Sentence.</li>
                  <li>Highlight the ones you use; if you use it, you lose it.</li>
                </ol>
              </div>
            </div>
            <textarea
              value={commentarySentence}
              onChange={(e) => setCommentarySentence(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border-2 border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-green-50"
              placeholder="Combine your best commentary phrases into a flowing sentence that explains why your concrete details support your argument..."
            />
          </div>

          {/* Concluding Sentence */}
          <div>
            <h3 className="text-lg font-semibold text-blue-600 mb-4 uppercase">
              Write Your Concluding Sentence
            </h3>
            <textarea
              value={concludingSentence}
              onChange={(e) => setConcludingSentence(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-blue-50"
              placeholder="Write a strong concluding sentence that reinforces your argument and ties back to your topic sentence..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-12">
          <Link
            href={`/dashboard/assignments/${assignment.id}/working-topic-sentence`}
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
              if (!saving && canProceed()) {
                router.push(`/dashboard/assignments/${assignment.id}/shaping`);
              }
            }}
            disabled={saving || !canProceed()}
            className="px-6 py-3 bg-[#3d8c33] text-white rounded-lg hover:bg-[#2d6625] disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : "Save and Next"}
          </button>
        </div>
      </div>

      {/* Assignment Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Assignment Progress
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-[#3d8c33]">First Draft</div>
            <div className="text-sm text-[#3d8c33]">Current Step</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              75%
            </div>
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
              <h3 className="text-xl font-bold text-gray-900">First Draft Tips</h3>
              <button
                onClick={() => setShowTipModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 text-gray-700">
              <div>
                <span className="font-semibold text-[#3d8c33]">1.</span> <strong>Revise your topic sentence</strong> to make it stronger and clearer.
              </div>
              
              <div>
                <span className="font-semibold text-[#3d8c33]">2.</span> <strong>Address the opposition</strong> by stating a concession and counterargument.
              </div>
              
              <div>
                <span className="font-semibold text-[#3d8c33]">3.</span> <strong>Refute the counterargument</strong> with strong reasoning.
              </div>

              <div>
                <span className="font-semibold text-[#3d8c33]">4.</span> <strong>Use your concrete details</strong> as evidence to support your argument.
              </div>

              <div>
                <span className="font-semibold text-[#3d8c33]">5.</span> <strong>Create flowing commentary</strong> that explains why your evidence matters.
              </div>

              <div>
                <span className="font-semibold text-[#3d8c33]">6.</span> <strong>End with a strong concluding sentence</strong> that reinforces your position.
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
