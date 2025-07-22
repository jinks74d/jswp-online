// components/dashboard/assignments/NarrativeDiscoveringTopicForm.tsx
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

interface NarrativeDiscoveringTopicFormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

export default function NarrativeDiscoveringTopicForm({
  assignment,
  studentProfile,
}: NarrativeDiscoveringTopicFormProps) {
  const router = useRouter();
  const [topicIdeas, setTopicIdeas] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [topicType, setTopicType] = useState<"event" | "person" | "place" | "thing">("event");
  const [organizationType, setOrganizationType] = useState<"event" | "ppt">("event");
  const [focusAreas, setFocusAreas] = useState({
    beginning: "",
    middle: "",
    end: "",
    feeling1: "",
    feeling2: "",
    feeling3: "",
  });
  const [currentIdeaInput, setCurrentIdeaInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Auto-save functionality with debouncing
  const debouncedAutoSave = useCallback(
    async (data: {
      topicIdeas: string[];
      selectedTopic: string;
      topicType: string;
      organizationType: string;
      focusAreas: typeof focusAreas;
    }) => {
      setAutoSaveStatus('saving');
      try {
        const response = await fetch('/api/student-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignment_id: assignment.id,
            student_id: studentProfile.id,
            concrete_details: JSON.stringify({
              topicIdeas: data.topicIdeas,
              selectedTopic: data.selectedTopic,
              topicType: data.topicType,
              organizationType: data.organizationType,
              focusAreas: data.focusAreas,
              status: "discovering_topic",
              working_on: "step_1"
            }),
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
      if (topicIdeas.length > 0 || selectedTopic || Object.values(focusAreas).some(v => v)) {
        debouncedAutoSave({
          topicIdeas,
          selectedTopic,
          topicType,
          organizationType,
          focusAreas
        });
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [topicIdeas, selectedTopic, topicType, organizationType, focusAreas, debouncedAutoSave]);

  // Load previous data on component mount
  useEffect(() => {
    const loadPreviousData = async () => {
      try {
        const response = await fetch(`/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`);
        const result = await response.json();
        
        if (response.ok && result.data?.concrete_details) {
          try {
            const stepData = JSON.parse(result.data.concrete_details);
            if (stepData.topicIdeas) setTopicIdeas(stepData.topicIdeas);
            if (stepData.selectedTopic) setSelectedTopic(stepData.selectedTopic);
            if (stepData.topicType) setTopicType(stepData.topicType);
            if (stepData.organizationType) setOrganizationType(stepData.organizationType);
            if (stepData.focusAreas) setFocusAreas(stepData.focusAreas);
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

  const addTopicIdea = () => {
    if (currentIdeaInput.trim()) {
      setTopicIdeas([...topicIdeas, currentIdeaInput.trim()]);
      setCurrentIdeaInput("");
    }
  };

  const selectTopic = (topic: string) => {
    console.log("Selecting topic:", topic);
    setSelectedTopic(topic);
    console.log("selectedTopic state updated to:", topic);
  };

  const handleFocusAreaChange = (field: string, value: string) => {
    setFocusAreas(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await debouncedAutoSave({
      topicIdeas,
      selectedTopic,
      topicType,
      organizationType,
      focusAreas
    });
    setSaving(false);
    alert("✅ Topic discovery saved successfully!");
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
            href={`/dashboard/assignments/${assignment.id}`}
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

      {/* Main Form - DISCOVERING THE TOPIC */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
        {/* Narrative Header with Icon and Help */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/narrative01-circle-cmyk.jpg"
            alt="Narrative"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            DISCOVERING THE TOPIC
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
        <div className="space-y-8">
          {/* Topic Type Selection */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              What type of topic will you write about?
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { value: "event", label: "Event" },
                { value: "person", label: "Person" },
                { value: "place", label: "Place" },
                { value: "thing", label: "Thing" }
              ].map((option) => (
                <label key={option.value} className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="topicType"
                    value={option.value}
                    checked={topicType === option.value}
                    onChange={(e) => setTopicType(e.target.value as "event" | "person" | "place" | "thing")}
                    className="mr-2"
                  />
                  <span className="font-medium text-gray-900">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Organization Type Selection */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              How do you want to organize your narrative?
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="organizationType"
                  value="event"
                  checked={organizationType === "event"}
                  onChange={(e) => setOrganizationType(e.target.value as "event" | "ppt")}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium text-gray-900">Event Organization</div>
                  <div className="text-sm text-gray-600">Beginning → Middle → End</div>
                </div>
              </label>
              <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="organizationType"
                  value="ppt"
                  checked={organizationType === "ppt"}
                  onChange={(e) => setOrganizationType(e.target.value as "event" | "ppt")}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium text-gray-900">Person/Place/Thing</div>
                  <div className="text-sm text-gray-600">Three reasons about the topic</div>
                </div>
              </label>
            </div>
          </div>

          {/* Topic Ideas Brainstorming */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Brainstorm Ideas for Your Topic
            </h3>
            
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  1
                </div>
                <div>
                  <p className="text-blue-800 font-medium">Add your topic ideas below</p>
                  <p className="text-blue-700 text-sm">Type an idea and click "Add Idea" or press Enter</p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                value={currentIdeaInput}
                onChange={(e) => setCurrentIdeaInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTopicIdea()}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#13161f] focus:border-[#13161f] text-gray-900"
                placeholder="Enter an idea for your narrative..."
              />
              <button
                onClick={addTopicIdea}
                className="px-6 py-3 bg-[#13161f] text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                Add Idea
              </button>
            </div>

            {/* Instructions for selection */}
            {topicIdeas.length > 0 && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    2
                  </div>
                  <div>
                    <p className="text-amber-800 font-medium">Click on one of your ideas to select it</p>
                    <p className="text-amber-700 text-sm">The selected idea will highlight in dark color with a checkmark</p>
                  </div>
                </div>
              </div>
            )}

            {/* Display Ideas */}
            <div className="space-y-2">
              {topicIdeas.map((idea, index) => (
                <div
                  key={index}
                  onClick={() => selectTopic(idea)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedTopic === idea
                      ? "border-[#13161f] bg-[#13161f] text-white"
                      : "border-gray-300 hover:border-gray-400 text-gray-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={selectedTopic === idea ? "text-white" : "text-gray-900"}>{idea}</span>
                    {selectedTopic === idea && (
                      <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                        <span className="text-[#13161f] text-xs">✓</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Success message when topic is selected */}
            {selectedTopic && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    ✓
                  </div>
                  <div>
                    <p className="text-green-800 font-medium">Topic selected: "{selectedTopic}"</p>
                    <p className="text-green-700 text-sm">You can now fill out the focus areas below and click "Save and Next"</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Focus Areas based on Organization Type */}
          {selectedTopic && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Focus Areas for "{selectedTopic}"
              </h3>
              
              {organizationType === "event" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Focus</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Beginning might focus on:</label>
                        <input
                          type="text"
                          value={focusAreas.beginning}
                          onChange={(e) => handleFocusAreaChange("beginning", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#13161f] focus:border-[#13161f] text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Middle might focus on:</label>
                        <input
                          type="text"
                          value={focusAreas.middle}
                          onChange={(e) => handleFocusAreaChange("middle", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#13161f] focus:border-[#13161f] text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">End might focus on:</label>
                        <input
                          type="text"
                          value={focusAreas.end}
                          onChange={(e) => handleFocusAreaChange("end", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#13161f] focus:border-[#13161f] text-gray-900"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Feelings</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">At first, I felt:</label>
                        <input
                          type="text"
                          value={focusAreas.feeling1}
                          onChange={(e) => handleFocusAreaChange("feeling1", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#13161f] focus:border-[#13161f] text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Later, I felt:</label>
                        <input
                          type="text"
                          value={focusAreas.feeling2}
                          onChange={(e) => handleFocusAreaChange("feeling2", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#13161f] focus:border-[#13161f] text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">At the end, I felt:</label>
                        <input
                          type="text"
                          value={focusAreas.feeling3}
                          onChange={(e) => handleFocusAreaChange("feeling3", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#13161f] focus:border-[#13161f] text-gray-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">First reason I chose this {topicType}:</label>
                    <input
                      type="text"
                      value={focusAreas.beginning}
                      onChange={(e) => handleFocusAreaChange("beginning", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#13161f] focus:border-[#13161f] text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Second reason I chose this {topicType}:</label>
                    <input
                      type="text"
                      value={focusAreas.middle}
                      onChange={(e) => handleFocusAreaChange("middle", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#13161f] focus:border-[#13161f] text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Third reason I chose this {topicType}:</label>
                    <input
                      type="text"
                      value={focusAreas.end}
                      onChange={(e) => handleFocusAreaChange("end", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#13161f] focus:border-[#13161f] text-gray-900"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-12">
          <Link
            href={`/dashboard/assignments/${assignment.id}`}
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
              console.log("Save and Next clicked");
              console.log("selectedTopic:", selectedTopic);
              console.log("Button disabled:", saving || !selectedTopic);
              
              if (!selectedTopic) {
                alert("Please select a topic first!");
                return;
              }
              
              await handleSave();
              if (!saving) {
                router.push(`/dashboard/assignments/${assignment.id}/gathering-cds`);
              }
            }}
            disabled={saving || !selectedTopic}
            className="px-6 py-3 bg-[#13161f] text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : "Save and Next"}
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
            <div className="text-2xl font-bold text-[#13161f]">Discovering Topic</div>
            <div className="text-sm text-[#13161f]">Current Step</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">20%</div>
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
                DISCOVERING THE TOPIC Tips
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
                <span className="font-semibold text-[#13161f]">1.</span> Brainstorm several ideas that fit your prompt before selecting one.
              </div>

              <div>
                <span className="font-semibold text-[#13161f]">2.</span> Choose the topic you know most about and can tell the best story about.
              </div>

              <div>
                <span className="font-semibold text-[#13161f]">3.</span> Consider whether to organize by event (beginning/middle/end) or by person/place/thing (three reasons).
              </div>

              <div>
                <span className="font-semibold text-[#13161f]">4.</span> Think about how your feelings changed throughout the experience.
              </div>

              <div>
                <span className="font-semibold text-[#13161f]">5.</span> Make sure your topic has enough detail to write a full narrative about.
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
