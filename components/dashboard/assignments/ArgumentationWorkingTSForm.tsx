// components/dashboard/assignments/ArgumentationWorkingTSForm.tsx
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

interface ArgumentationWorkingTSFormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

export default function ArgumentationWorkingTSForm({
  assignment,
  studentProfile,
}: ArgumentationWorkingTSFormProps) {
  const router = useRouter();
  const [selectedTopicSentenceIdea, setSelectedTopicSentenceIdea] = useState("");
  const [workingTopicSentence, setWorkingTopicSentence] = useState("");
  const [selectedCDs, setSelectedCDs] = useState<{
    chunk1CDs: string[];
    chunk2CDs: string[];
    selectedChunk1CDs: number[];
    selectedChunk2CDs: number[];
  }>({
    chunk1CDs: [],
    chunk2CDs: [],
    selectedChunk1CDs: [],
    selectedChunk2CDs: []
  });
  const [commentaryData, setCommentaryData] = useState<{[key: string]: string}>({});
  const [saving, setSaving] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Auto-save functionality with debouncing
  const debouncedAutoSave = useCallback(
    async (data: { workingTopicSentence: string; commentaryData: {[key: string]: string} }) => {
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
          step3: {
            workingTopicSentence: data.workingTopicSentence,
            commentaryData: data.commentaryData,
            status: "working_topic_sentence",
            working_on: "step_3"
          },
          step: 'working_topic_sentence',
          workingTopicSentence: data.workingTopicSentence,
          commentaryData: data.commentaryData,
          status: "working_topic_sentence",
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
      if (workingTopicSentence.trim().length > 0 || Object.keys(commentaryData).length > 0) {
        debouncedAutoSave({ workingTopicSentence, commentaryData });
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [workingTopicSentence, commentaryData, debouncedAutoSave]);

  // Load previous step data on component mount
  useEffect(() => {
    const loadPreviousData = async () => {
      try {
        const response = await fetch(`/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`);
        const result = await response.json();
        
        if (response.ok && result.data?.concrete_details) {
          try {
            const stepData = JSON.parse(result.data.concrete_details);
            
            // Load selected CDs from step 1
            if (stepData.chunk1CDs || stepData.chunk2CDs) {
              setSelectedCDs({
                chunk1CDs: stepData.chunk1CDs || [],
                chunk2CDs: stepData.chunk2CDs || [],
                selectedChunk1CDs: stepData.selectedChunk1CDs || [],
                selectedChunk2CDs: stepData.selectedChunk2CDs || []
              });
            }
            
            // Load selected topic sentence from T-Chart (step 2)
            if (stepData.tChartData) {
              // Find the selected TS from the T-Chart data
              const positiveRows = stepData.tChartData.positiveRows || [];
              const negativeRows = stepData.tChartData.negativeRows || [];
              
              const selectedTSRow = [...positiveRows, ...negativeRows].find(row => row.isTS);
              if (selectedTSRow && selectedTSRow.reason) {
                setWorkingTopicSentence(selectedTSRow.reason);
              }
            }
            
            // Load working topic sentence if returning to this step
            if (stepData.workingTopicSentence) {
              setWorkingTopicSentence(stepData.workingTopicSentence);
            }
            
            // Load commentary data if returning to this step
            if (stepData.commentaryData) {
              setCommentaryData(stepData.commentaryData);
            }
          } catch (error) {
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
        } catch (error) {
          console.log("No existing data to preserve");
        }
      }

      // Merge with existing data to preserve previous steps
      const mergedData = {
        ...existingStepData,
        step: 'working_topic_sentence',
        workingTopicSentence,
        commentaryData,
        status: "working_topic_sentence",
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

      alert(`✅ Working Topic Sentence saved successfully!`);
      
    } catch (error) {
      console.error("Error saving working topic sentence:", error);
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

  const canProceed = () => {
    return workingTopicSentence.trim().length > 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/assignments/${assignment.id}/decisions`}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Topic Sentence Development
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

      {/* Main Form - WORKING TOPIC SENTENCE */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
        {/* Argumentation Header with Icon and Help */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/argumentation01-circle-cmyk.jpg"
            alt="Argumentation"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            WORKING TOPIC SENTENCE
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
          {/* Your Selected Topic Sentence Idea */}
          {selectedTopicSentenceIdea && (
            <div className="bg-blue-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">
                Your Selected Topic Sentence Idea
              </h3>
              <div className="p-4 bg-white rounded border border-blue-200">
                <p className="text-blue-800 font-medium">{selectedTopicSentenceIdea}</p>
              </div>
              <p className="text-blue-700 text-sm mt-2">
                This is the idea you selected from your T-Chart analysis. Now turn this into a complete topic sentence.
              </p>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-green-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              Instructions
            </h3>
            <div className="text-green-800 space-y-2 text-sm">
              <p><strong>1.</strong> Make a sentence out of your selected topic sentence idea from the previous screen.</p>
              <p><strong>2.</strong> Remember, this is still a first draft - you can revise it later.</p>
              <p><strong>3.</strong> Your topic sentence should clearly state your position on the argument.</p>
            </div>
          </div>

          {/* Working Topic Sentence Input */}
          <div>
            <label className="block text-lg font-semibold text-gray-900 mb-4">
              Write your Working Topic Sentence
            </label>
            <textarea
              value={workingTopicSentence}
              onChange={(e) => setWorkingTopicSentence(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border-2 border-[#3d8c33] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3d8c33] focus:border-[#3d8c33] text-gray-900 text-lg"
              placeholder="Turn your selected idea into a complete topic sentence that clearly states your argument position..."
            />
            <div className="mt-3 text-sm text-gray-600">
              <p><strong>Tips for a strong topic sentence:</strong></p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Clearly state your position on the topic</li>
                <li>Be specific and focused</li>
                <li>Avoid being too broad or vague</li>
                <li>Make it arguable - someone could disagree with it</li>
              </ul>
            </div>
          </div>

          {/* Character/Word Count */}
          <div className="text-right text-sm text-gray-500">
            {workingTopicSentence.length} characters | {workingTopicSentence.trim().split(/\s+/).filter(word => word.length > 0).length} words
          </div>

          {/* Commentary Development Section */}
          <div className="mt-12">
            <h3 className="text-xl font-bold text-green-600 mb-6">
              COMMENTARY DEVELOPMENT
            </h3>
            <p className="text-gray-700 mb-6">
              For each CD, provide WORDS AND PHRASES that explain why this CD is a good one for your argument. Your CMs should support the selected CD and the TS.
            </p>

            {/* Selected CDs with Commentary Inputs */}
            <div className="space-y-8">
              {/* Chunk 1 CDs */}
              {selectedCDs.selectedChunk1CDs.map((selectedIndex, displayIndex) => {
                const cdKey = `chunk1-${selectedIndex}`;
                return (
                  <div key={cdKey} className="border border-gray-300 rounded-lg p-6">
                    <div className="flex items-start gap-4">
                      {/* CD Number and Text */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <span className="bg-red-600 text-white text-sm font-bold px-3 py-1 rounded">
                            CONCRETE DETAIL #{displayIndex + 1}:
                          </span>
                        </div>
                        <div className="text-red-600 font-bold text-lg mb-4 uppercase">
                          {selectedCDs.chunk1CDs[selectedIndex]}
                        </div>
                        
                        {/* Commentary Inputs */}
                        <div className="space-y-4">
                          <div className="text-center text-sm text-gray-600 mb-2">
                            <strong>CMs</strong><br />
                            This CD was important because...Why?
                          </div>
                          
                          {/* Commentary Input Grid */}
                          <div className="grid grid-cols-2 gap-4">
                            <input
                              type="text"
                              value={commentaryData[`${cdKey}-1`] || ''}
                              onChange={(e) => setCommentaryData(prev => ({
                                ...prev,
                                [`${cdKey}-1`]: e.target.value
                              }))}
                              className="px-3 py-2 border-2 border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-gray-900"
                              placeholder=""
                            />
                            <input
                              type="text"
                              value={commentaryData[`${cdKey}-2`] || ''}
                              onChange={(e) => setCommentaryData(prev => ({
                                ...prev,
                                [`${cdKey}-2`]: e.target.value
                              }))}
                              className="px-3 py-2 border-2 border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-gray-900"
                              placeholder=""
                            />
                          </div>
                          
                          <div className="flex justify-center">
                            <input
                              type="text"
                              value={commentaryData[`${cdKey}-3`] || ''}
                              onChange={(e) => setCommentaryData(prev => ({
                                ...prev,
                                [`${cdKey}-3`]: e.target.value
                              }))}
                              className="w-1/2 px-3 py-2 border-2 border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-gray-900"
                              placeholder=""
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <input
                              type="text"
                              value={commentaryData[`${cdKey}-4`] || ''}
                              onChange={(e) => setCommentaryData(prev => ({
                                ...prev,
                                [`${cdKey}-4`]: e.target.value
                              }))}
                              className="px-3 py-2 border-2 border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-gray-900"
                              placeholder=""
                            />
                            <input
                              type="text"
                              value={commentaryData[`${cdKey}-5`] || ''}
                              onChange={(e) => setCommentaryData(prev => ({
                                ...prev,
                                [`${cdKey}-5`]: e.target.value
                              }))}
                              className="px-3 py-2 border-2 border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-gray-900"
                              placeholder=""
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Chunk 2 CDs */}
              {selectedCDs.selectedChunk2CDs.map((selectedIndex, displayIndex) => {
                const cdKey = `chunk2-${selectedIndex}`;
                const cdNumber = selectedCDs.selectedChunk1CDs.length + displayIndex + 1;
                return (
                  <div key={cdKey} className="border border-gray-300 rounded-lg p-6">
                    <div className="flex items-start gap-4">
                      {/* CD Number and Text */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <span className="bg-red-600 text-white text-sm font-bold px-3 py-1 rounded">
                            CONCRETE DETAIL #{cdNumber}:
                          </span>
                        </div>
                        <div className="text-red-600 font-bold text-lg mb-4 uppercase">
                          {selectedCDs.chunk2CDs[selectedIndex]}
                        </div>
                        
                        {/* Commentary Inputs */}
                        <div className="space-y-4">
                          <div className="text-center text-sm text-gray-600 mb-2">
                            <strong>CMs</strong><br />
                            This CD was important because...Why?
                          </div>
                          
                          {/* Commentary Input Grid */}
                          <div className="grid grid-cols-2 gap-4">
                            <input
                              type="text"
                              value={commentaryData[`${cdKey}-1`] || ''}
                              onChange={(e) => setCommentaryData(prev => ({
                                ...prev,
                                [`${cdKey}-1`]: e.target.value
                              }))}
                              className="px-3 py-2 border-2 border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-gray-900"
                              placeholder=""
                            />
                            <input
                              type="text"
                              value={commentaryData[`${cdKey}-2`] || ''}
                              onChange={(e) => setCommentaryData(prev => ({
                                ...prev,
                                [`${cdKey}-2`]: e.target.value
                              }))}
                              className="px-3 py-2 border-2 border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-gray-900"
                              placeholder=""
                            />
                          </div>
                          
                          <div className="flex justify-center">
                            <input
                              type="text"
                              value={commentaryData[`${cdKey}-3`] || ''}
                              onChange={(e) => setCommentaryData(prev => ({
                                ...prev,
                                [`${cdKey}-3`]: e.target.value
                              }))}
                              className="w-1/2 px-3 py-2 border-2 border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-gray-900"
                              placeholder=""
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <input
                              type="text"
                              value={commentaryData[`${cdKey}-4`] || ''}
                              onChange={(e) => setCommentaryData(prev => ({
                                ...prev,
                                [`${cdKey}-4`]: e.target.value
                              }))}
                              className="px-3 py-2 border-2 border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-gray-900"
                              placeholder=""
                            />
                            <input
                              type="text"
                              value={commentaryData[`${cdKey}-5`] || ''}
                              onChange={(e) => setCommentaryData(prev => ({
                                ...prev,
                                [`${cdKey}-5`]: e.target.value
                              }))}
                              className="px-3 py-2 border-2 border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-gray-900"
                              placeholder=""
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-12">
          <Link
            href={`/dashboard/assignments/${assignment.id}/decisions`}
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
                router.push(`/dashboard/assignments/${assignment.id}/first-draft`);
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
            <div className="text-2xl font-bold text-[#3d8c33]">Working Topic Sentence</div>
            <div className="text-sm text-[#3d8c33]">Current Step</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              50%
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
              <h3 className="text-xl font-bold text-gray-900">Working Topic Sentence Tips</h3>
              <button
                onClick={() => setShowTipModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 text-gray-700">
              <div>
                <span className="font-semibold text-[#3d8c33]">Purpose:</span> Transform your selected idea from the T-Chart into a complete, arguable topic sentence.
              </div>
              
              <div>
                <span className="font-semibold text-[#3d8c33]">Remember:</span> This is still a first draft. You can revise and improve it in later steps.
              </div>
              
              <div>
                <span className="font-semibold text-[#3d8c33]">Strong Topic Sentences:</span>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Clearly state your position</li>
                  <li>Are specific and focused</li>
                  <li>Can be argued (someone could disagree)</li>
                  <li>Preview the main point of your paragraph</li>
                </ul>
              </div>

              <div>
                <span className="font-semibold text-[#3d8c33]">Example:</span> If your idea was "helps students learn responsibility," your topic sentence might be: "The new tardy policy helps students develop important life skills by teaching them responsibility and time management."
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
