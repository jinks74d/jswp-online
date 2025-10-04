// components/dashboard/assignments/unified/UnifiedWorkingTopicSentenceForm.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Clock, User, HelpCircle, X, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserProfile } from "@/lib/supabase";
import { getWorkingTopicSentenceConfig, WritingStyle } from "@/lib/assignment-configs";

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

interface UnifiedWorkingTopicSentenceFormProps {
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

interface SelectedCDs {
  chunk1CDs: string[];
  chunk2CDs: string[];
  selectedChunk1CDs: number[];
  selectedChunk2CDs: number[];
}

export default function UnifiedWorkingTopicSentenceForm({
  assignment,
  studentProfile,
}: UnifiedWorkingTopicSentenceFormProps) {
  const router = useRouter();
  const config = getWorkingTopicSentenceConfig(assignment.writing_style as WritingStyle);
  const isSimple = config.behavior.commentaryStructure === 'simple';

  // Shared state
  const [workingTopicSentence, setWorkingTopicSentence] = useState("");
  const [saving, setSaving] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // State for simple commentary (argumentation)
  const [commentaryData, setCommentaryData] = useState<{[key: string]: string}>({});
  const [selectedCDs, setSelectedCDs] = useState<SelectedCDs>({
    chunk1CDs: [],
    chunk2CDs: [],
    selectedChunk1CDs: [],
    selectedChunk2CDs: []
  });

  // State for CD sections (expository)
  const [cdSections, setCdSections] = useState<CDSection[]>([]);
  const [selectedChunks, setSelectedChunks] = useState(1);

  // Load previous step data on component mount
  useEffect(() => {
    const loadPreviousData = async () => {
      try {
        const response = await fetch(`/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`);
        const result = await response.json();

        if (response.ok && result.data?.concrete_details) {
          try {
            const stepData = JSON.parse(result.data.concrete_details);

            // Load working topic sentence
            if (stepData.workingTopicSentence) {
              setWorkingTopicSentence(stepData.workingTopicSentence);
            }

            if (isSimple) {
              // Load for simple commentary structure (argumentation)
              if (stepData.chunk1CDs || stepData.chunk2CDs) {
                setSelectedCDs({
                  chunk1CDs: stepData.chunk1CDs || [],
                  chunk2CDs: stepData.chunk2CDs || [],
                  selectedChunk1CDs: stepData.selectedChunk1CDs || [],
                  selectedChunk2CDs: stepData.selectedChunk2CDs || []
                });
              }

              // Load selected topic sentence from T-Chart (step 2)
              if (stepData.tChartData && !stepData.workingTopicSentence) {
                const positiveRows = stepData.tChartData.positiveRows || [];
                const negativeRows = stepData.tChartData.negativeRows || [];

                const selectedTSRow = [...positiveRows, ...negativeRows].find((row: any) => row.isTS);
                if (selectedTSRow && selectedTSRow.reason) {
                  setWorkingTopicSentence(selectedTSRow.reason);
                }
              }

              // Load commentary data
              if (stepData.commentaryData) {
                setCommentaryData(stepData.commentaryData);
              }
            } else {
              // Load for CD sections structure (expository)
              if (result.data.selected_chunks) {
                setSelectedChunks(result.data.selected_chunks);
              }

              // Check if cdSections with CM data already exists
              if (stepData.cdSections && stepData.cdSections.length > 0 && stepData.cdSections.some((s: CDSection) => s.cms.some(cm => cm.trim() !== ''))) {
                setCdSections(stepData.cdSections);
              } else {
                // Create initial structure from selected CDs
                const initialCdSections: CDSection[] = [];

                // Process Chunk 1
                if (stepData.chunk1CDs && stepData.selectedChunk1CDs) {
                  stepData.selectedChunk1CDs.forEach((index: number) => {
                    if (stepData.chunk1CDs[index]) {
                      initialCdSections.push({
                        cdText: stepData.chunk1CDs[index],
                        cms: Array(config.behavior.cdSections?.cmFieldCount || 5).fill(""),
                      });
                    }
                  });
                }

                // Process Chunk 2
                if (stepData.selectedChunks === 2 && stepData.chunk2CDs && stepData.selectedChunk2CDs) {
                  stepData.selectedChunk2CDs.forEach((index: number) => {
                    if (stepData.chunk2CDs[index]) {
                      initialCdSections.push({
                        cdText: stepData.chunk2CDs[index],
                        cms: Array(config.behavior.cdSections?.cmFieldCount || 5).fill(""),
                      });
                    }
                  });
                }
                setCdSections(initialCdSections);
              }
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
  }, [assignment.id, studentProfile.id, isSimple, config.behavior.cdSections?.cmFieldCount]);

  // Auto-save functionality with debouncing
  const debouncedAutoSave = useCallback(
    async () => {
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
        const mergedData = isSimple
          ? {
              ...existingStepData,
              workingTopicSentence,
              commentaryData,
              status: "working_topic_sentence",
              working_on: "step_3"
            }
          : {
              ...existingStepData,
              workingTopicSentence,
              cdSections,
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
            writing_style: assignment.writing_style
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
    [assignment.id, assignment.writing_style, studentProfile.id, workingTopicSentence, commentaryData, cdSections, isSimple]
  );

  // Auto-save when data changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const hasContent = isSimple
        ? (workingTopicSentence.trim().length > 0 || Object.keys(commentaryData).length > 0)
        : (workingTopicSentence.trim() || cdSections.some(section => section.cms.some(cm => cm.trim())));

      if (hasContent) {
        debouncedAutoSave();
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [workingTopicSentence, commentaryData, cdSections, isSimple, debouncedAutoSave]);

  // Handlers for CD sections (expository)
  const updateCM = (cdIndex: number, cmIndex: number, value: string) => {
    setCdSections(prev => {
      const updated = [...prev];
      updated[cdIndex].cms[cmIndex] = value;
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validate before saving
      const validationData = isSimple
        ? { workingTopicSentence, commentaryData }
        : { workingTopicSentence, cdSections };

      const validation = config.validation.validateSubmit(validationData);

      if (!validation.valid) {
        alert(`⚠️ ${validation.message}`);
        setSaving(false);
        return;
      }

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
      const mergedData = isSimple
        ? {
            ...existingStepData,
            workingTopicSentence,
            commentaryData,
            status: "working_topic_sentence",
            working_on: "step_3"
          }
        : {
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
        writing_style: assignment.writing_style,
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

  const handleSaveAndNext = async () => {
    // Validate before proceeding
    const validationData = isSimple
      ? { workingTopicSentence, commentaryData }
      : { workingTopicSentence, cdSections };

    const validation = config.validation.validateSubmit(validationData);

    if (!validation.valid) {
      alert(`⚠️ ${validation.message}`);
      return;
    }

    await handleSave();
    if (!saving) {
      const nextRoute = config.nextStepRoute.replace('[id]', assignment.id);
      router.push(nextRoute);
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

  // Get style-specific assets and colors
  const styleAssets = {
    argumentation: {
      image: "/assets/argumentation01-circle-cmyk.jpg",
      primaryColor: "#3d8c33",
      secondaryColor: "#2d6625",
      cdColor: "#b3172c",
    },
    expository: {
      image: "/assets/expository01-circle-cmyk.jpg",
      primaryColor: "#22356d",
      secondaryColor: "#1a2952",
      cdColor: "#b3172c",
    }
  };

  const assets = styleAssets[config.style as 'argumentation' | 'expository'] || styleAssets.argumentation;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/assignments/${assignment.id}/${isSimple ? 'decisions' : 'gathering-cds'}`}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to {isSimple ? 'Topic Sentence Development' : 'Gathering CDs'}
          </Link>
        </div>

        {/* Print and Due Date */}
        <div className="flex items-center gap-4">
          {!isSimple && (
            <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
              <Printer className="w-5 h-5" />
            </button>
          )}

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

      {/* Assignment Info (only for argumentation) */}
      {isSimple && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4 mb-4">
            <img
              src={assets.image}
              alt={config.displayName}
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
      )}

      {/* Main Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
        {/* Header with Icon and Help */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src={assets.image}
            alt={config.displayName}
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            {config.ui.pageTitle.toUpperCase()}
          </h2>
          <button
            onClick={() => setShowTipModal(true)}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
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
          {/* Instructions */}
          <div className={`${isSimple ? 'bg-green-50' : 'bg-blue-50'} p-6 rounded-lg`}>
            <h3 className={`text-lg font-semibold ${isSimple ? 'text-green-900' : 'text-blue-900'} mb-2`}>
              Instructions
            </h3>
            <p className={`${isSimple ? 'text-green-800' : 'text-blue-800'} text-sm`}>
              {config.ui.instructionText}
            </p>
          </div>

          {/* Working Topic Sentence Input */}
          <div>
            <label className="block text-lg font-semibold text-gray-900 mb-4">
              {config.ui.topicSentenceLabel}
            </label>
            <textarea
              value={workingTopicSentence}
              onChange={(e) => setWorkingTopicSentence(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 text-gray-900 text-lg"
              style={{ borderColor: assets.primaryColor }}
              placeholder={config.ui.topicSentencePlaceholder}
            />
            {isSimple && (
              <>
                <div className="mt-3 text-sm text-gray-600">
                  <p><strong>Tips for a strong topic sentence:</strong></p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Clearly state your position on the topic</li>
                    <li>Be specific and focused</li>
                    <li>Avoid being too broad or vague</li>
                    <li>Make it arguable - someone could disagree with it</li>
                  </ul>
                </div>
                <div className="mt-3 text-right text-sm text-gray-500">
                  {workingTopicSentence.length} characters | {workingTopicSentence.trim().split(/\s+/).filter(word => word.length > 0).length} words
                </div>
              </>
            )}
          </div>

          {/* Simple Commentary Section (Argumentation) */}
          {isSimple && (
            <div className="mt-12">
              <h3 className="text-xl font-bold mb-6" style={{ color: assets.primaryColor }}>
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
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-4">
                            <span className="text-white text-sm font-bold px-3 py-1 rounded" style={{ backgroundColor: assets.cdColor }}>
                              CONCRETE DETAIL #{displayIndex + 1}:
                            </span>
                          </div>
                          <div className="font-bold text-lg mb-4 uppercase" style={{ color: assets.cdColor }}>
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
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-4">
                            <span className="text-white text-sm font-bold px-3 py-1 rounded" style={{ backgroundColor: assets.cdColor }}>
                              CONCRETE DETAIL #{cdNumber}:
                            </span>
                          </div>
                          <div className="font-bold text-lg mb-4 uppercase" style={{ color: assets.cdColor }}>
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
          )}

          {/* CD Sections (Expository) */}
          {!isSimple && cdSections.map((cdSection, cdIndex) => (
            <div key={cdIndex} className="space-y-6">
              {/* Concrete Detail Header */}
              <div className="text-white p-4 rounded-lg" style={{ backgroundColor: assets.cdColor }}>
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

                  {/* Central Oval */}
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
            href={`/dashboard/assignments/${assignment.id}/${isSimple ? 'decisions' : 'gathering-cds'}`}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            {config.ui.buttons.save === 'Save Progress' ? 'Back' : config.ui.buttons.save}
          </Link>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : config.ui.buttons.save}
          </button>

          <button
            onClick={handleSaveAndNext}
            disabled={saving}
            className="px-6 py-3 text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors font-medium"
            style={{ backgroundColor: assets.primaryColor }}
          >
            {saving ? "Saving..." : config.ui.buttons.next}
          </button>
        </div>
      </div>

      {/* Assignment Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Assignment Progress
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg" style={{ backgroundColor: `${assets.primaryColor}20` }}>
            <div className="text-2xl font-bold" style={{ color: assets.primaryColor }}>
              {config.ui.pageTitle}
            </div>
            <div className="text-sm" style={{ color: assets.primaryColor }}>Current Step</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {isSimple ? '50%' : '75%'}
            </div>
            <div className="text-sm text-blue-600">Estimated Progress</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {daysUntilDue}
            </div>
            <div className="text-sm text-red-600">Days Remaining</div>
          </div>
        </div>
      </div>

      {/* Tip Modal */}
      {showTipModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">{config.ui.helpText.title}</h3>
              <button
                onClick={() => setShowTipModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-gray-700">
              {config.ui.helpText.sections.map((section, index) => (
                <div key={index}>
                  <span className="font-semibold" style={{ color: assets.primaryColor }}>
                    {section.heading}:
                  </span>
                  <p className="mt-1">{section.content}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowTipModal(false)}
                className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors"
                style={{ backgroundColor: assets.primaryColor }}
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
