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

interface ElaborationData {
  topicSentence: string;
  chunk1CD: string;
  chunk1CM1: string;
  chunk1CM2: string;
  chunk2CD: string;
  chunk2CM1: string;
  chunk2CM2: string;
  selectedChunks: number;
  topicSentenceWord: string;
  // WOW data for topic sentence word
  topicSentenceWordSynonym: string;
  topicSentenceWordPhrase1: string;
  topicSentenceWordPhrase2: string;
  // WOW data for chunk 1 CM1
  chunk1CM1Synonym: string;
  chunk1CM1Phrase1: string;
  chunk1CM1Phrase2: string;
  // WOW data for chunk 1 CM2
  chunk1CM2Synonym: string;
  chunk1CM2Phrase1: string;
  chunk1CM2Phrase2: string;
  // WOW data for chunk 2 CM1
  chunk2CM1Synonym: string;
  chunk2CM1Phrase1: string;
  chunk2CM1Phrase2: string;
  // WOW data for chunk 2 CM2
  chunk2CM2Synonym: string;
  chunk2CM2Phrase1: string;
  chunk2CM2Phrase2: string;
}

interface ElaborationFormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

export default function ElaborationForm({
  assignment,
  studentProfile,
}: ElaborationFormProps) {
  const router = useRouter();
  const [elaborationData, setElaborationData] = useState<ElaborationData>({
    topicSentence: "",
    chunk1CD: "",
    chunk1CM1: "",
    chunk1CM2: "",
    chunk2CD: "",
    chunk2CM1: "",
    chunk2CM2: "",
    selectedChunks: 1,
    topicSentenceWord: "",
    topicSentenceWordSynonym: "",
    topicSentenceWordPhrase1: "",
    topicSentenceWordPhrase2: "",
    chunk1CM1Synonym: "",
    chunk1CM1Phrase1: "",
    chunk1CM1Phrase2: "",
    chunk1CM2Synonym: "",
    chunk1CM2Phrase1: "",
    chunk1CM2Phrase2: "",
    chunk2CM1Synonym: "",
    chunk2CM1Phrase1: "",
    chunk2CM1Phrase2: "",
    chunk2CM2Synonym: "",
    chunk2CM2Phrase1: "",
    chunk2CM2Phrase2: "",
  });
  const [saving, setSaving] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Auto-save functionality with debouncing
  const debouncedAutoSave = useCallback(
    async (data: ElaborationData) => {
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
          step4: data,
          status: "elaborating",
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
      if (elaborationData.topicSentence.trim() || 
          elaborationData.topicSentenceWordSynonym.trim() ||
          elaborationData.chunk1CM1Synonym.trim() ||
          elaborationData.chunk1CM2Synonym.trim()) {
        debouncedAutoSave(elaborationData);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [elaborationData, debouncedAutoSave]);

  // Load previous step data on component mount
  useEffect(() => {
    const loadPreviousData = async () => {
      try {
        const response = await fetch(`/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`);
        const result = await response.json();
        
        if (response.ok && result.data) {
          if (result.data.concrete_details) {
            try {
              const stepData = JSON.parse(result.data.concrete_details);
              
              // Load data from previous steps
              let chunk1CD = "";
              let chunk2CD = "";
              let selectedChunks = 1;
              let topicSentenceWord = "";
              let chunk1CM1 = "";
              let chunk1CM2 = "";
              let chunk2CM1 = "";
              let chunk2CM2 = "";
              
              // Load Step 1 data (CDs)
              if (stepData.chunk1CDs && stepData.selectedChunk1CD !== null) {
                chunk1CD = stepData.chunk1CDs[stepData.selectedChunk1CD] || "";
                selectedChunks = stepData.selectedChunks || 1;
              }
              
              if (stepData.chunk2CDs && stepData.selectedChunk2CD !== null) {
                chunk2CD = stepData.chunk2CDs[stepData.selectedChunk2CD] || "";
                selectedChunks = 2;
              }
              
              // Load Step 3 data (decisions)
              if (stepData.step3) {
                topicSentenceWord = stepData.step3.topicSentenceWord || "";
                chunk1CM1 = stepData.step3.chunk1CM1 || "";
                chunk1CM2 = stepData.step3.chunk1CM2 || "";
                chunk2CM1 = stepData.step3.chunk2CM1 || "";
                chunk2CM2 = stepData.step3.chunk2CM2 || "";
              }

              // Load Step 4 data if returning to this step
              let step4Data = {
                topicSentence: "",
                topicSentenceWordSynonym: "",
                topicSentenceWordPhrase1: "",
                topicSentenceWordPhrase2: "",
                chunk1CM1Synonym: "",
                chunk1CM1Phrase1: "",
                chunk1CM1Phrase2: "",
                chunk1CM2Synonym: "",
                chunk1CM2Phrase1: "",
                chunk1CM2Phrase2: "",
                chunk2CM1Synonym: "",
                chunk2CM1Phrase1: "",
                chunk2CM1Phrase2: "",
                chunk2CM2Synonym: "",
                chunk2CM2Phrase1: "",
                chunk2CM2Phrase2: "",
              };
              
              if (stepData.step4) {
                step4Data = { ...step4Data, ...stepData.step4 };
              }

              setElaborationData({
                ...step4Data,
                chunk1CD,
                chunk1CM1,
                chunk1CM2,
                chunk2CD,
                chunk2CM1,
                chunk2CM2,
                selectedChunks,
                topicSentenceWord
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
        step4: elaborationData,
        status: "elaborating",
        working_on: "step_4"
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

      alert(`✅ Elaboration saved successfully!`);
      
    } catch (error) {
      console.error("Error saving elaboration:", error);
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

  // Validation for completion
  const isComplete = () => {
    return elaborationData.topicSentence.trim().length > 0 &&
           elaborationData.chunk1CM1Synonym.trim().length > 0 &&
           elaborationData.chunk1CM2Synonym.trim().length > 0 &&
           (elaborationData.selectedChunks === 1 || 
            (elaborationData.chunk2CM1Synonym.trim().length > 0 && 
             elaborationData.chunk2CM2Synonym.trim().length > 0));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/assignments/${assignment.id}/start`}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Assignment
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

      {/* Main Form - ELABORATION */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
        {/* Literary Header with Icon and Help */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/literary01-circle-cmyk.jpg"
            alt="Literary"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            ELABORATION
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
          {/* Topic Sentence Creation - MOVED TO TOP */}
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">
              Create your topic sentence using your elaborated word: "{elaborationData.topicSentenceWord}"
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-blue-700 mb-2">
                Topic Sentence
              </label>
              <textarea
                value={elaborationData.topicSentence}
                onChange={(e) => setElaborationData(prev => ({ ...prev, topicSentence: e.target.value }))}
                rows={3}
                className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-blue-900"
                placeholder={`Write a topic sentence using "${elaborationData.topicSentenceWord}" or one of your elaborated words/phrases...`}
              />
            </div>
          </div>

          {/* Display selected data from previous steps */}
          <div className="p-6 rounded-lg border border-gray-200">
            <h3 className="text-gray-800 font-medium mb-4">Your Selected Elements:</h3>
            <div className="space-y-3">
              <div>
                <span className="font-medium text-gray-700">Topic Sentence Word:</span> <span className="text-blue-600 font-medium">{elaborationData.topicSentenceWord || "None selected"}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Chunk 1 CDs:</span> <span className="text-red-600 font-medium">{elaborationData.chunk1CD || "None selected"}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Chunk 1 Commentary:</span> <span className="text-green-600 font-medium">{[elaborationData.chunk1CM1, elaborationData.chunk1CM2].filter(Boolean).join(', ') || "None selected"}</span>
              </div>
              {elaborationData.selectedChunks === 2 && (
                <>
                  <div>
                    <span className="font-medium text-gray-700">Chunk 2 CDs:</span> <span className="text-red-600 font-medium">{elaborationData.chunk2CD || "None selected"}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Chunk 2 Commentary:</span> <span className="text-green-600 font-medium">{[elaborationData.chunk2CM1, elaborationData.chunk2CM2].filter(Boolean).join(', ') || "None selected"}</span>
                  </div>
                </>
              )}
            </div>
          </div>


          {/* Web-off-the-Word for Chunk 1 Commentary Words */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Web-off-the-Word™: Chunk 1 Commentary Words
            </h3>
            <div className="mb-4">
              <span className="font-medium text-gray-700">CD:</span> <span className="text-red-600 font-medium">{elaborationData.chunk1CD || "None selected"}</span>
            </div>
            
            {/* Chunk 1 CM1 */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="text-md font-semibold text-gray-800 mb-4">
                Commentary Word 1: "{elaborationData.chunk1CM1}"
              </h4>
              <div className="space-y-4">
                {/* Synonym - Full width */}
                <div className="w-1/2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Synonym
                  </label>
                  <input
                    type="text"
                    value={elaborationData.chunk1CM1Synonym}
                    onChange={(e) => setElaborationData(prev => ({ ...prev, chunk1CM1Synonym: e.target.value }))}
                    className="w-full px-3 py-2 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-green-700"
                    placeholder="Enter a synonym"
                  />
                </div>
                {/* Phrases - Side by side with gap */}
                <div className="flex gap-12">
                  <div className="w-1/2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phrase 1
                    </label>
                    <textarea
                      value={elaborationData.chunk1CM1Phrase1}
                      onChange={(e) => setElaborationData(prev => ({ ...prev, chunk1CM1Phrase1: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-green-700 resize-y"
                      placeholder="Enter a phrase"
                    />
                  </div>
                  <div className="w-1/2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phrase 2
                    </label>
                    <textarea
                      value={elaborationData.chunk1CM1Phrase2}
                      onChange={(e) => setElaborationData(prev => ({ ...prev, chunk1CM1Phrase2: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-green-700 resize-y"
                      placeholder="Enter another phrase"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Chunk 1 CM2 */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="text-md font-semibold text-gray-800 mb-4">
                Commentary Word 2: "{elaborationData.chunk1CM2}"
              </h4>
              <div className="space-y-4">
                {/* Synonym - 50% width */}
                <div className="w-1/2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Synonym
                  </label>
                  <input
                    type="text"
                    value={elaborationData.chunk1CM2Synonym}
                    onChange={(e) => setElaborationData(prev => ({ ...prev, chunk1CM2Synonym: e.target.value }))}
                    className="w-full px-3 py-2 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-green-700"
                    placeholder="Enter a synonym"
                  />
                </div>
                {/* Phrases - Side by side with gap */}
                <div className="flex gap-12">
                  <div className="w-1/2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phrase 1
                    </label>
                    <textarea
                      value={elaborationData.chunk1CM2Phrase1}
                      onChange={(e) => setElaborationData(prev => ({ ...prev, chunk1CM2Phrase1: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-green-700 resize-y"
                      placeholder="Enter a phrase"
                    />
                  </div>
                  <div className="w-1/2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phrase 2
                    </label>
                    <textarea
                      value={elaborationData.chunk1CM2Phrase2}
                      onChange={(e) => setElaborationData(prev => ({ ...prev, chunk1CM2Phrase2: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-green-700 resize-y"
                      placeholder="Enter another phrase"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Web-off-the-Word for Chunk 2 Commentary Words (if applicable) */}
          {elaborationData.selectedChunks === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Web-off-the-Word™: Chunk 2 Commentary Words
              </h3>
              <div className="mb-4">
                <span className="font-medium text-gray-700">CD:</span> <span className="text-red-600 font-medium">{elaborationData.chunk2CD || "None selected"}</span>
              </div>
              
              {/* Chunk 2 CM1 */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="text-md font-semibold text-gray-800 mb-4">
                  Commentary Word 1: "{elaborationData.chunk2CM1}"
                </h4>
                <div className="space-y-4">
                  {/* Synonym - 50% width */}
                  <div className="w-1/2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Synonym
                    </label>
                    <input
                      type="text"
                      value={elaborationData.chunk2CM1Synonym}
                      onChange={(e) => setElaborationData(prev => ({ ...prev, chunk2CM1Synonym: e.target.value }))}
                      className="w-full px-3 py-2 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-green-700"
                      placeholder="Enter a synonym"
                    />
                  </div>
                  {/* Phrases - Side by side with gap */}
                  <div className="flex gap-12">
                    <div className="w-1/2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phrase 1
                      </label>
                      <textarea
                        value={elaborationData.chunk2CM1Phrase1}
                        onChange={(e) => setElaborationData(prev => ({ ...prev, chunk2CM1Phrase1: e.target.value }))}
                        rows={2}
                        className="w-full px-3 py-2 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-green-700 resize-y"
                        placeholder="Enter a phrase"
                      />
                    </div>
                    <div className="w-1/2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phrase 2
                      </label>
                      <textarea
                        value={elaborationData.chunk2CM1Phrase2}
                        onChange={(e) => setElaborationData(prev => ({ ...prev, chunk2CM1Phrase2: e.target.value }))}
                        rows={2}
                        className="w-full px-3 py-2 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-green-700 resize-y"
                        placeholder="Enter another phrase"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Chunk 2 CM2 */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="text-md font-semibold text-gray-800 mb-4">
                  Commentary Word 2: "{elaborationData.chunk2CM2}"
                </h4>
                <div className="space-y-4">
                  {/* Synonym - 50% width */}
                  <div className="w-1/2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Synonym
                    </label>
                    <input
                      type="text"
                      value={elaborationData.chunk2CM2Synonym}
                      onChange={(e) => setElaborationData(prev => ({ ...prev, chunk2CM2Synonym: e.target.value }))}
                      className="w-full px-3 py-2 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-green-700"
                      placeholder="Enter a synonym"
                    />
                  </div>
                  {/* Phrases - Side by side with gap */}
                  <div className="flex gap-12">
                    <div className="w-1/2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phrase 1
                      </label>
                      <textarea
                        value={elaborationData.chunk2CM2Phrase1}
                        onChange={(e) => setElaborationData(prev => ({ ...prev, chunk2CM2Phrase1: e.target.value }))}
                        rows={2}
                        className="w-full px-3 py-2 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-green-700 resize-y"
                        placeholder="Enter a phrase"
                      />
                    </div>
                    <div className="w-1/2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phrase 2
                      </label>
                      <textarea
                        value={elaborationData.chunk2CM2Phrase2}
                        onChange={(e) => setElaborationData(prev => ({ ...prev, chunk2CM2Phrase2: e.target.value }))}
                        rows={2}
                        className="w-full px-3 py-2 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-green-700 resize-y"
                        placeholder="Enter another phrase"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Instructions
            </h3>
            <div className="text-gray-700 space-y-2">
              <p>• Use the Web-off-the-Word™ technique to elaborate on your selected words</p>
              <p>• Create synonyms and phrases that deepen the meaning of your commentary words</p>
              <p>• Write a topic sentence that incorporates your elaborated understanding</p>
              <p>• This elaboration will help you write richer commentary in your body paragraphs</p>
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
              if (!saving && isComplete()) {
                router.push(`/dashboard/assignments/${assignment.id}/first-draft`);
              } else if (!isComplete()) {
                alert("Please complete the topic sentence and Web-off-the-Word elaborations before continuing.");
              }
            }}
            disabled={saving || !isComplete()}
            className="px-6 py-3 bg-[#3f8b31] text-white rounded-lg hover:bg-[#2d6625] disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : "Save and Next"}
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
            <div className="text-2xl font-bold text-[#23366e]">Elaboration</div>
            <div className="text-sm text-[#23366e]">Current Step</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-[#3f8b31]">67%</div>
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
              <h3 className="text-xl font-bold text-gray-900">ELABORATION Tips</h3>
              <button
                onClick={() => setShowTipModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 text-gray-700">
              <div>
                <span className="font-semibold text-[#23366e]">1.</span> Web-off-the-Word™ helps you elaborate on your selected commentary words.
              </div>
              
              <div>
                <span className="font-semibold text-[#23366e]">2.</span> Create synonyms that have the same tone and meaning as your original word.
              </div>
              
              <div>
                <span className="font-semibold text-[#23366e]">3.</span> Write phrases (2+ words) that elaborate on what the word means in context.
              </div>
              
              <div>
                <span className="font-semibold text-[#23366e]">4.</span> Use your elaborated understanding to write a strong topic sentence.
              </div>
              
              <div>
                <span className="font-semibold text-[#23366e]">5.</span> This preparation will help you write richer commentary in your body paragraphs.
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
