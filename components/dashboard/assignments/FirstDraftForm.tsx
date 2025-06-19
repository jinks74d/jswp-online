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

interface FirstDraftData {
  // Previous step data
  topicSentence: string;
  chunk1CD: string;
  chunk1CM1: string;
  chunk1CM2: string;
  chunk2CD: string;
  chunk2CM1: string;
  chunk2CM2: string;
  selectedChunks: number;
  topicSentenceWord: string;
  // Commentary words from previous steps
  chunk1CMWords: string[];
  chunk2CMWords: string[];
  // Elaboration data from Step 4
  chunk1CM1Synonym: string;
  chunk1CM1Phrase1: string;
  chunk1CM1Phrase2: string;
  chunk1CM2Synonym: string;
  chunk1CM2Phrase1: string;
  chunk1CM2Phrase2: string;
  chunk2CM1Synonym: string;
  chunk2CM1Phrase1: string;
  chunk2CM1Phrase2: string;
  chunk2CM2Synonym: string;
  chunk2CM2Phrase1: string;
  chunk2CM2Phrase2: string;
  // Chunk 1 commentary sentences
  chunk1CommentarySentence1: string;
  chunk1CommentarySentence2: string;
  // Chunk 2 commentary sentences
  chunk2CommentarySentence1: string;
  chunk2CommentarySentence2: string;
  // Concluding sentence
  concludingSentence: string;
  // Selected concluding word
  concludingWord: string;
  // Web-off-the-Word circle inputs
  webWord1: string;
  webWord2: string;
  webWord3: string;
  webWord4: string;
  // Selected commentary words for writing sentences
  selectedCMWords: string[];
}

interface FirstDraftFormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

export default function FirstDraftForm({
  assignment,
  studentProfile,
}: FirstDraftFormProps) {
  const router = useRouter();
  const [draftData, setDraftData] = useState<FirstDraftData>({
    topicSentence: "",
    chunk1CD: "",
    chunk1CM1: "",
    chunk1CM2: "",
    chunk2CD: "",
    chunk2CM1: "",
    chunk2CM2: "",
    selectedChunks: 1,
    topicSentenceWord: "",
    chunk1CMWords: [],
    chunk2CMWords: [],
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
    chunk1CommentarySentence1: "",
    chunk1CommentarySentence2: "",
    chunk2CommentarySentence1: "",
    chunk2CommentarySentence2: "",
    concludingSentence: "",
    concludingWord: "",
    webWord1: "",
    webWord2: "",
    webWord3: "",
    webWord4: "",
    selectedCMWords: [],
  });
  const [saving, setSaving] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved"
  >("idle");

  // Auto-save functionality with debouncing
  const debouncedAutoSave = useCallback(
    async (data: FirstDraftData) => {
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
          step5: {
            chunk1CommentarySentence1: data.chunk1CommentarySentence1,
            chunk1CommentarySentence2: data.chunk1CommentarySentence2,
            chunk2CommentarySentence1: data.chunk2CommentarySentence1,
            chunk2CommentarySentence2: data.chunk2CommentarySentence2,
            concludingSentence: data.concludingSentence,
            concludingWord: data.concludingWord,
          },
          status: "writing_first_draft",
          working_on: "step_5",
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
      if (
        draftData.chunk1CommentarySentence1.trim() ||
        draftData.chunk1CommentarySentence2.trim() ||
        draftData.concludingSentence.trim()
      ) {
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

              // Load data from previous steps
              let chunk1CD = "";
              let chunk2CD = "";
              let selectedChunks = 1;
              let topicSentence = "";
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

              // Load commentary words from previous steps
              let chunk1CMWords: string[] = [];
              let chunk2CMWords: string[] = [];

              // Load Step 3 data (decisions)
              if (stepData.step3) {
                topicSentenceWord = stepData.step3.topicSentenceWord || "";
                chunk1CM1 = stepData.step3.chunk1CM1 || "";
                chunk1CM2 = stepData.step3.chunk1CM2 || "";
                chunk2CM1 = stepData.step3.chunk2CM1 || "";
                chunk2CM2 = stepData.step3.chunk2CM2 || "";
              }

              // Load commentary words from Step 2 (commentary generation)
              if (stepData.step2) {
                chunk1CMWords = stepData.step2.chunk1Words || [];
                chunk2CMWords = stepData.step2.chunk2Words || [];
              }

              // Load Step 4 data (elaboration/topic sentence)
              if (stepData.step4) {
                topicSentence = stepData.step4.topicSentence || "";
              }

              // Load Step 5 data if returning to this step
              let step5Data = {
                chunk1CommentarySentence1: "",
                chunk1CommentarySentence2: "",
                chunk2CommentarySentence1: "",
                chunk2CommentarySentence2: "",
                concludingSentence: "",
                concludingWord: "",
              };

              if (stepData.step5) {
                step5Data = { ...step5Data, ...stepData.step5 };
              }

              setDraftData({
                ...step5Data,
                topicSentence,
                topicSentenceWord,
                chunk1CD,
                chunk1CM1,
                chunk1CM2,
                chunk2CD,
                chunk2CM1,
                chunk2CM2,
                selectedChunks,
                chunk1CMWords,
                chunk2CMWords,
                chunk1CM1Synonym: stepData.step4?.chunk1CM1Synonym || "",
                chunk1CM1Phrase1: stepData.step4?.chunk1CM1Phrase1 || "",
                chunk1CM1Phrase2: stepData.step4?.chunk1CM1Phrase2 || "",
                chunk1CM2Synonym: stepData.step4?.chunk1CM2Synonym || "",
                chunk1CM2Phrase1: stepData.step4?.chunk1CM2Phrase1 || "",
                chunk1CM2Phrase2: stepData.step4?.chunk1CM2Phrase2 || "",
                chunk2CM1Synonym: stepData.step4?.chunk2CM1Synonym || "",
                chunk2CM1Phrase1: stepData.step4?.chunk2CM1Phrase1 || "",
                chunk2CM1Phrase2: stepData.step4?.chunk2CM1Phrase2 || "",
                chunk2CM2Synonym: stepData.step4?.chunk2CM2Synonym || "",
                chunk2CM2Phrase1: stepData.step4?.chunk2CM2Phrase1 || "",
                chunk2CM2Phrase2: stepData.step4?.chunk2CM2Phrase2 || "",
                webWord1: "",
                webWord2: "",
                webWord3: "",
                webWord4: "",
                selectedCMWords: [],
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
        step5: {
          chunk1CommentarySentence1: draftData.chunk1CommentarySentence1,
          chunk1CommentarySentence2: draftData.chunk1CommentarySentence2,
          chunk2CommentarySentence1: draftData.chunk2CommentarySentence1,
          chunk2CommentarySentence2: draftData.chunk2CommentarySentence2,
          concludingSentence: draftData.concludingSentence,
          concludingWord: draftData.concludingWord,
        },
        status: "writing_first_draft",
        working_on: "step_5",
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

      alert(`✅ First draft saved successfully!`);
    } catch (error) {
      console.error("Error saving first draft:", error);
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

  // Handle CM word selection
  const toggleCMWordSelection = (word: string) => {
    setDraftData((prev) => ({
      ...prev,
      selectedCMWords: prev.selectedCMWords.includes(word)
        ? prev.selectedCMWords.filter((w) => w !== word)
        : [...prev.selectedCMWords, word],
    }));
  };

  // Get all available CM words
  const getAllCMWords = () => {
    const words = [
      draftData.chunk1CM1 || "unexplainable",
      draftData.chunk1CM2 || "ethereal",
      "immeasurable",
      "sublime",
      "no Earthly comparison",
      "beyond words",
      "a sense of otherworldliness",
      "transcends the mundane world",
    ];

    if (draftData.selectedChunks === 2) {
      words.push(
        draftData.chunk2CM1 || "grief-stricken",
        draftData.chunk2CM2 || "consumed",
        "angry",
        "obsessed",
        "in complete denial; blames the angels for being jealous",
        "nothing in this world could have destroyed their love",
        "during his sleep, in the darkness -- in death",
        "cannot part with her; love stronger than even death"
      );
    }

    return words;
  };

  // Validation for completion
  const isComplete = () => {
    const chunk1Complete =
      draftData.chunk1CommentarySentence1.trim().length > 0 &&
      draftData.chunk1CommentarySentence2.trim().length > 0;

    if (draftData.selectedChunks === 1) {
      return chunk1Complete && draftData.concludingSentence.trim().length > 0;
    } else {
      const chunk2Complete =
        draftData.chunk2CommentarySentence1.trim().length > 0 &&
        draftData.chunk2CommentarySentence2.trim().length > 0;
      return (
        chunk1Complete &&
        chunk2Complete &&
        draftData.concludingSentence.trim().length > 0
      );
    }
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

      {/* Main Form - WRITING THE FIRST DRAFT */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
        {/* Literary Header with Icon and Help */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/literary01-circle-cmyk.jpg"
            alt="Literary"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            WRITING THE FIRST DRAFT
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
          {/* Topic Sentence Display */}
          <div className="p-4 bg-blue-100 border-2 border-blue-300 rounded-lg">
            <p className="text-blue-900 font-medium text-left">
              {draftData.topicSentence ||
                "No topic sentence available from previous steps"}
            </p>
          </div>

          {/* Chunk 1 Section */}
          <div className="space-y-4">
            {/* CD and Commentary Words Display */}
            <div className="p-4 bg-red-600 text-white rounded-lg">
              <p className="font-bold text-left">
                {draftData.chunk1CD ||
                  "No concrete detail available from previous steps"}
              </p>
            </div>

            {/* Commentary Words Grid */}
            <div className="grid grid-cols-2 gap-4">
              {draftData.chunk1CMWords && draftData.chunk1CMWords.length > 0 ? (
                draftData.chunk1CMWords.filter(word => word && word.trim()).map((word, index) => {
                  const isSelected = draftData.selectedCMWords.includes(word);
                  return (
                    <button
                      key={index}
                      onClick={() => toggleCMWordSelection(word)}
                      className={`p-3 border border-green-300 rounded text-center cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-green-600 text-white"
                          : "bg-green-100 text-green-800 hover:bg-green-200"
                      }`}
                    >
                      <span className="font-medium">{word}</span>
                    </button>
                  );
                })
              ) : (
                <div className="col-span-2 text-center text-gray-500 p-4">
                  No commentary words available from previous steps
                </div>
              )}
            </div>

            {/* Commentary Sentence Writing */}
            <div className="space-y-4">
              <h3 className="font-bold text-gray-800">
                WRITE YOUR COMMENTARY SENTENCE FOR CHUNK 1:
              </h3>
              <p className="text-sm text-gray-600">
                • Review the meaning CMs. Select the one(s) to create two or
                more Commentary Sentences
                <br />• Hint: Save the one(s) with a "finished feeling" for the
                Concluding Sentence *
              </p>

              <div className="p-4 border-2 border-green-500 rounded-lg">
                <textarea
                  value={draftData.chunk1CommentarySentence1}
                  onChange={(e) =>
                    setDraftData((prev) => ({
                      ...prev,
                      chunk1CommentarySentence1: e.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full px-3 py-2 border-0 focus:outline-none resize-none text-green-800"
                  placeholder=""
                />
              </div>

              <h4 className="font-bold text-gray-800">
                WRITE YOUR SECOND AND ANY ADDITIONAL COMMENTARY SENTENCES:
              </h4>
              <div className="p-4 border-2 border-green-500 rounded-lg">
                <textarea
                  value={draftData.chunk1CommentarySentence2}
                  onChange={(e) =>
                    setDraftData((prev) => ({
                      ...prev,
                      chunk1CommentarySentence2: e.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full px-3 py-2 border-0 focus:outline-none resize-none text-green-800"
                  placeholder=""
                />
              </div>
            </div>
          </div>

          {/* Chunk 2 Section (if applicable) */}
          {draftData.selectedChunks === 2 && (
            <div className="space-y-4">
              {/* CD and Commentary Words Display */}
              <div className="p-4 bg-red-600 text-white rounded-lg">
                <p className="font-bold text-left">
                  {draftData.chunk2CD ||
                    "No concrete detail available from previous steps"}
                </p>
              </div>

              {/* Commentary Words Grid */}
              <div className="grid grid-cols-2 gap-4">
                {draftData.chunk2CMWords &&
                draftData.chunk2CMWords.length > 0 ? (
                  draftData.chunk2CMWords.map((word, index) => {
                    const isSelected = draftData.selectedCMWords.includes(word);
                    return (
                      <button
                        key={index}
                        onClick={() => toggleCMWordSelection(word)}
                        className={`p-3 border border-green-300 rounded text-center cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-green-600 text-white"
                            : "bg-green-100 text-green-800 hover:bg-green-200"
                        }`}
                      >
                        <span className="font-medium">{word}</span>
                      </button>
                    );
                  })
                ) : (
                  <div className="col-span-2 text-center text-gray-500 p-4">
                    No commentary words available from previous steps
                  </div>
                )}
              </div>

              {/* Commentary Sentence Writing */}
              <div className="space-y-4">
                <h3 className="font-bold text-gray-800">
                  WRITE YOUR COMMENTARY SENTENCE FOR CHUNK 2:
                </h3>

                <div className="p-4 border-2 border-green-500 rounded-lg">
                  <textarea
                    value={draftData.chunk2CommentarySentence1}
                    onChange={(e) =>
                      setDraftData((prev) => ({
                        ...prev,
                        chunk2CommentarySentence1: e.target.value,
                      }))
                    }
                    rows={2}
                    className="w-full px-3 py-2 border-0 focus:outline-none resize-none text-green-800"
                    placeholder=""
                  />
                </div>

                <h4 className="font-bold text-gray-800">
                  WRITE YOUR SECOND AND ANY ADDITIONAL COMMENTARY SENTENCES:
                </h4>
                <div className="p-4 border-2 border-green-500 rounded-lg">
                  <textarea
                    value={draftData.chunk2CommentarySentence2}
                    onChange={(e) =>
                      setDraftData((prev) => ({
                        ...prev,
                        chunk2CommentarySentence2: e.target.value,
                      }))
                    }
                    rows={2}
                    className="w-full px-3 py-2 border-0 focus:outline-none resize-none text-green-800"
                    placeholder=""
                  />
                </div>
              </div>
            </div>
          )}

          {/* Concluding Sentence Section */}
          <div className="space-y-4">
            <h3 className="font-bold text-gray-800">
              WRITE YOUR CONCLUDING SENTENCE:
            </h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>
                • The Middle Circle has the word you selected for your Topic
                Sentence.
              </p>
              <p>
                • In the boxes, provide one or two synonyms for the TS word.
              </p>
              <p>• In the boxes, provide one or two phrases for the TS word.</p>
              <p>
                • Select the words and phrases that best reflects the TS,
                answers the prompt, and provides a finished feeling.
              </p>
              <p>
                • If you have CMs above that you did not use, determine if any
                of those might work here.
              </p>
            </div>

            {/* Web-off-the-Word Circle */}
            <div className="flex justify-center my-8">
              <div className="relative">
                <div className="w-80 h-80 border-4 border-blue-600 rounded-full flex items-center justify-center">
                  <div className="flex flex-col items-center space-y-3">
                    <input
                      type="text"
                      value={draftData.webWord1}
                      onChange={(e) =>
                        setDraftData((prev) => ({
                          ...prev,
                          webWord1: e.target.value,
                        }))
                      }
                      className="w-32 p-2 border border-blue-400 rounded bg-blue-50 text-blue-800 font-medium text-center text-sm block"
                      placeholder=""
                    />
                    <input
                      type="text"
                      value={draftData.webWord2}
                      onChange={(e) =>
                        setDraftData((prev) => ({
                          ...prev,
                          webWord2: e.target.value,
                        }))
                      }
                      className="w-32 p-2 border border-blue-400 rounded bg-blue-50 text-blue-800 font-medium text-center text-sm block"
                      placeholder=""
                    />
                    <div className="p-3 border-2 border-blue-600 rounded-lg bg-blue-100">
                      <span className="text-blue-900 font-bold">
                        {draftData.topicSentenceWord || "extraordinary"}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={draftData.webWord3}
                      onChange={(e) =>
                        setDraftData((prev) => ({
                          ...prev,
                          webWord3: e.target.value,
                        }))
                      }
                      className="w-32 p-2 border border-blue-400 rounded bg-blue-50 text-blue-800 font-medium text-center text-sm block"
                      placeholder=""
                    />
                    <input
                      type="text"
                      value={draftData.webWord4}
                      onChange={(e) =>
                        setDraftData((prev) => ({
                          ...prev,
                          webWord4: e.target.value,
                        }))
                      }
                      className="w-32 p-2 border border-blue-400 rounded bg-blue-50 text-blue-800 font-medium text-center text-sm block"
                      placeholder=""
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-300 rounded-lg">
              <input
                type="text"
                value={draftData.concludingSentence}
                onChange={(e) =>
                  setDraftData((prev) => ({
                    ...prev,
                    concludingSentence: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border-0 focus:outline-none text-blue-800 bg-transparent text-left"
                placeholder=""
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-12">
          <Link
            href={`/dashboard/assignments/${assignment.id}/elaboration`}
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
                  `/dashboard/assignments/${assignment.id}/body-paragraphs`
                );
              } else if (!isComplete()) {
                alert(
                  "Please complete all commentary sentences and the concluding sentence before continuing."
                );
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
            <div className="text-2xl font-bold text-[#23366e]">First Draft</div>
            <div className="text-sm text-[#23366e]">Current Step</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-[#3f8b31]">83%</div>
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
                FIRST DRAFT Tips
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
                <span className="font-semibold text-[#23366e]">1.</span> Use
                your selected concrete details and commentary words to write
                commentary sentences.
              </div>

              <div>
                <span className="font-semibold text-[#23366e]">2.</span> Write
                at least two commentary sentences for each chunk.
              </div>

              <div>
                <span className="font-semibold text-[#23366e]">3.</span> Save
                words with a "finished feeling" for your concluding sentence.
              </div>

              <div>
                <span className="font-semibold text-[#23366e]">4.</span> Use the
                Web-off-the-Word™ circle to help craft your concluding sentence.
              </div>

              <div>
                <span className="font-semibold text-[#23366e]">5.</span> Ensure
                your concluding sentence provides closure and answers the
                prompt.
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
