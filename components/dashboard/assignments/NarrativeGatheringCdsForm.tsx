// components/dashboard/assignments/NarrativeGatheringCdsForm.tsx
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

interface NarrativeGatheringCdsFormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

export default function NarrativeGatheringCdsForm({
  assignment,
  studentProfile,
}: NarrativeGatheringCdsFormProps) {
  const router = useRouter();
  const [topicSentence, setTopicSentence] = useState("");
  const [tChartData, setTChartData] = useState({
    when_cd: "",
    when_cm: "",
    where_cd: "",
    where_cm: "",
    who_cd: "",
    who_cm: "",
    what_cd: "",
    what_cm: "",
    dialogue_cd: "",
    dialogue_cm: "",
  });
  const [previousStepData, setPreviousStepData] = useState({
    selectedTopic: "",
    focusAreas: {
      beginning: "",
      middle: "",
      end: "",
      feeling1: "",
      feeling2: "",
      feeling3: "",
    },
    organizationType: "event" as "event" | "ppt"
  });
  const [saving, setSaving] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Auto-save functionality with debouncing
  const debouncedAutoSave = useCallback(
    async (data: { topicSentence: string; tChartData: typeof tChartData }) => {
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
          ...data,  // Step 2 data
          status: "gathering_cds",
          working_on: "step_2"
        };

        const response = await fetch('/api/student-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignment_id: assignment.id,
            student_id: studentProfile.id,
            concrete_details: JSON.stringify(mergedData),
            writing_style: "narrative",
            status: "in_progress"
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
      if (topicSentence.trim() || Object.values(tChartData).some(v => v.trim())) {
        debouncedAutoSave({
          topicSentence,
          tChartData
        });
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [topicSentence, tChartData, debouncedAutoSave]);

  // Load previous data on component mount
  useEffect(() => {
    const loadPreviousData = async () => {
      try {
        const response = await fetch(`/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`);
        const result = await response.json();
        
        if (response.ok && result.data?.concrete_details) {
          try {
            const stepData = JSON.parse(result.data.concrete_details);
            
            // Load previous step data from discovering topic
            if (stepData.selectedTopic && stepData.focusAreas && stepData.organizationType) {
              setPreviousStepData({
                selectedTopic: stepData.selectedTopic,
                focusAreas: stepData.focusAreas,
                organizationType: stepData.organizationType
              });
              
              // Generate topic sentence for Body Paragraph 1 using beginning focus and feeling1
              if (!stepData.topicSentence && stepData.focusAreas.beginning) {
                const generatedTopicSentence = stepData.organizationType === "event" 
                  ? `${stepData.focusAreas.beginning} ${stepData.focusAreas.feeling1 || ''}`.trim()
                  : stepData.focusAreas.beginning;
                setTopicSentence(generatedTopicSentence);
              }
            }
            
            // Load current step data
            if (stepData.tChartData) {
              setTChartData(stepData.tChartData);
            }
            if (stepData.topicSentence) {
              setTopicSentence(stepData.topicSentence);
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

  const handleInputChange = (field: string, value: string) => {
    setTChartData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await debouncedAutoSave({
      topicSentence,
      tChartData
    });
    setSaving(false);
    alert("✅ T-Chart data saved successfully!");
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/assignments/${assignment.id}/discovering-topic`}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Discovering Topic
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

        {/* Prompt */}
        <div className="p-4 bg-[#13161f] rounded-lg text-white">
          <h3 className="font-medium mb-2">Narrative Prompt</h3>
          <p>{assignment.prompt || "No prompt provided"}</p>
        </div>
      </div>

      {/* Main Form - GATHERING CDS */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
        {/* Narrative Header with Icon and Help */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/narrative01-circle-cmyk.jpg"
            alt="Narrative"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            T-CHART FOR BODY PARAGRAPH 1
          </h2>
          <button
            onClick={() => setShowTipModal(true)}
            className="p-2 text-gray-500 hover:text-[#13161f] transition-colors"
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
        <div className="space-y-6">
          {/* TOPIC SENTENCE */}
          <div>
            <label className="block text-sm font-medium text-blue-600 mb-2 uppercase">
              TOPIC SENTENCE
            </label>
            <textarea
              value={topicSentence}
              onChange={(e) => setTopicSentence(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder="My decision to start my job and move to Texas narrative chronicles..."
            />
          </div>

          {/* Headers */}
          <div className="text-center p-3 bg-red-500 text-white font-bold rounded-lg mb-2">
            GATHERING CONCRETE DETAILS (CDs)
          </div>
          <div className="text-center p-3 bg-green-500 text-white font-bold rounded-lg mb-6">
            GENERATING COMMENTARY (CMs)
          </div>

          {/* WHEN Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 uppercase">
                DETAILS ABOUT WHEN:
              </label>
              <textarea
                value={tChartData.when_cd}
                onChange={(e) => handleInputChange("when_cd", e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
                placeholder="When did this happen?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 uppercase">
                WHAT WERE YOU THINKING? WHY WAS THIS IMPORTANT?
              </label>
              <textarea
                value={tChartData.when_cm}
                onChange={(e) => handleInputChange("when_cm", e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                placeholder="What were you thinking? Why was this important?"
              />
            </div>
          </div>

          {/* WHERE Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 uppercase">
                DETAILS ABOUT WHERE:
              </label>
              <textarea
                value={tChartData.where_cd}
                onChange={(e) => handleInputChange("where_cd", e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
                placeholder="Where did this happen?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 uppercase">
                WHAT WERE YOU THINKING? WHY WAS THIS IMPORTANT?
              </label>
              <textarea
                value={tChartData.where_cm}
                onChange={(e) => handleInputChange("where_cm", e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                placeholder="What were you thinking? Why was this important?"
              />
            </div>
          </div>

          {/* WHO Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 uppercase">
                DETAILS ABOUT WHO:
              </label>
              <textarea
                value={tChartData.who_cd}
                onChange={(e) => handleInputChange("who_cd", e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
                placeholder="Who was involved?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 uppercase">
                WHAT WERE YOU THINKING? WHY WAS THIS IMPORTANT?
              </label>
              <textarea
                value={tChartData.who_cm}
                onChange={(e) => handleInputChange("who_cm", e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                placeholder="What were you thinking? Why was this important?"
              />
            </div>
          </div>

          {/* WHAT Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 uppercase">
                DETAILS ABOUT WHAT HAPPENED:
              </label>
              <textarea
                value={tChartData.what_cd}
                onChange={(e) => handleInputChange("what_cd", e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
                placeholder="What happened?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 uppercase">
                WHAT WERE YOU THINKING? WHY WAS THIS IMPORTANT?
              </label>
              <textarea
                value={tChartData.what_cm}
                onChange={(e) => handleInputChange("what_cm", e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                placeholder="What were you thinking? Why was this important?"
              />
            </div>
          </div>

          {/* DIALOGUE Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 uppercase">
                DIALOGUE?
              </label>
              <textarea
                value={tChartData.dialogue_cd}
                onChange={(e) => handleInputChange("dialogue_cd", e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
                placeholder="What did people say?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 uppercase">
                WHAT WERE YOU THINKING? WHY WAS THIS IMPORTANT?
              </label>
              <textarea
                value={tChartData.dialogue_cm}
                onChange={(e) => handleInputChange("dialogue_cm", e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                placeholder="What were you thinking? Why was this important?"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-12">
          <Link
            href={`/dashboard/assignments/${assignment.id}/discovering-topic`}
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
              router.push(`/dashboard/assignments/${assignment.id}/shaping-1`);
            }}
            disabled={saving}
            className="px-6 py-3 bg-[#13161f] text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : "Save and Continue to Shaping Sheet 1"}
          </button>
        </div>
      </div>

      {/* Assignment Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Narrative Assignment Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-[#13161f]">Gathering CDs</div>
            <div className="text-sm text-[#13161f]">Current Step</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">40%</div>
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
              <h3 className="text-xl font-bold text-gray-900">
                GATHERING CDS Tips
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
                <span className="font-semibold text-[#13161f]">WHO:</span> Think about all the people who were part of your story. Include yourself and others who played important roles.
              </div>

              <div>
                <span className="font-semibold text-[#13161f]">WHAT:</span> Describe the main events and actions that happened in your story. What were the key moments?
              </div>

              <div>
                <span className="font-semibold text-[#13161f]">WHEN:</span> Be specific about the time - was it morning, afternoon, evening? What season? What year?
              </div>

              <div>
                <span className="font-semibold text-[#13161f]">WHERE:</span> Describe the setting in detail. Where exactly did your story take place?
              </div>

              <div>
                <span className="font-semibold text-[#13161f]">DIALOGUE:</span> Include important conversations and things people said. Use quotation marks for direct quotes.
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
