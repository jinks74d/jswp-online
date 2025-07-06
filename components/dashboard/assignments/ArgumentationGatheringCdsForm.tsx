// components/dashboard/assignments/ArgumentationGatheringCdsForm.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Clock, User, HelpCircle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserProfile } from "@/lib/supabase";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import SortableCDItem from './SortableCDItem';

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

interface ArgumentationGatheringCDsFormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

export default function ArgumentationGatheringCDsForm({
  assignment,
  studentProfile,
}: ArgumentationGatheringCDsFormProps) {
  const router = useRouter();
  const [chunk1CDs, setChunk1CDs] = useState<string[]>([]);
  const [chunk2CDs, setChunk2CDs] = useState<string[]>([]);
  const [selectedChunk1CDs, setSelectedChunk1CDs] = useState<number[]>([]);
  const [selectedChunk2CDs, setSelectedChunk2CDs] = useState<number[]>([]);
  const [currentChunk1Input, setCurrentChunk1Input] = useState("");
  const [currentChunk2Input, setCurrentChunk2Input] = useState("");
  const [selectedChunks, setSelectedChunks] = useState(1); // Default to 1, will be loaded from previous step
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const addChunk1CD = () => {
    if (currentChunk1Input.trim()) {
      setChunk1CDs([...chunk1CDs, currentChunk1Input.trim()]);
      setCurrentChunk1Input("");
    }
  };

  const addChunk2CD = () => {
    if (currentChunk2Input.trim()) {
      setChunk2CDs([...chunk2CDs, currentChunk2Input.trim()]);
      setCurrentChunk2Input("");
    }
  };

  const selectChunk1CD = (index: number) => {
    setSelectedChunk1CDs(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };

  const selectChunk2CD = (index: number) => {
    setSelectedChunk2CDs(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };

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
          ...data,  // Step 1 data
          status: "gathering_cds",
          working_on: "step_1"
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
      if (chunk1CDs.length > 0 || chunk2CDs.length > 0) {
        debouncedAutoSave({
          chunk1CDs,
          chunk2CDs,
          selectedChunk1CDs,
          selectedChunk2CDs,
          selectedChunks
        });
      }
    }, 1000); // Auto-save after 1 second of inactivity

    return () => clearTimeout(timeoutId);
  }, [chunk1CDs, chunk2CDs, selectedChunk1CDs, selectedChunk2CDs, selectedChunks, debouncedAutoSave]);

  // Drag and drop handlers
  const handleDragEnd = (event: any, chunkNumber: 1 | 2) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      if (chunkNumber === 1) {
        setChunk1CDs((items) => {
          const oldIndex = items.findIndex((_, index) => `chunk1-${index}` === active.id);
          const newIndex = items.findIndex((_, index) => `chunk1-${index}` === over.id);
          
          const newItems = arrayMove(items, oldIndex, newIndex);
          
          // Update selected indices for multiple selection
          setSelectedChunk1CDs(prev => {
            return prev.map(selectedIndex => {
              if (selectedIndex === oldIndex) {
                return newIndex;
              } else if (selectedIndex > oldIndex && selectedIndex <= newIndex) {
                return selectedIndex - 1;
              } else if (selectedIndex < oldIndex && selectedIndex >= newIndex) {
                return selectedIndex + 1;
              }
              return selectedIndex;
            });
          });
          
          return newItems;
        });
      } else {
        setChunk2CDs((items) => {
          const oldIndex = items.findIndex((_, index) => `chunk2-${index}` === active.id);
          const newIndex = items.findIndex((_, index) => `chunk2-${index}` === over.id);
          
          const newItems = arrayMove(items, oldIndex, newIndex);
          
          // Update selected indices for multiple selection
          setSelectedChunk2CDs(prev => {
            return prev.map(selectedIndex => {
              if (selectedIndex === oldIndex) {
                return newIndex;
              } else if (selectedIndex > oldIndex && selectedIndex <= newIndex) {
                return selectedIndex - 1;
              } else if (selectedIndex < oldIndex && selectedIndex >= newIndex) {
                return selectedIndex + 1;
              }
              return selectedIndex;
            });
          });
          
          return newItems;
        });
      }
    }
  };

  // Load previous step data on component mount
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
          
          // Load any existing CD data if returning to this step
          if (result.data.concrete_details) {
            try {
              const cdData = JSON.parse(result.data.concrete_details);
              if (cdData.chunk1CDs) setChunk1CDs(cdData.chunk1CDs);
              if (cdData.chunk2CDs) setChunk2CDs(cdData.chunk2CDs);
              if (cdData.selectedChunk1CDs !== undefined) setSelectedChunk1CDs(cdData.selectedChunk1CDs);
              if (cdData.selectedChunk2CDs !== undefined) setSelectedChunk2CDs(cdData.selectedChunk2CDs);
              if (cdData.selectedChunks) setSelectedChunks(cdData.selectedChunks);
            } catch (error) {
              console.log("No existing CD data to load");
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
        chunk1CDs,
        chunk2CDs,
        selectedChunk1CDs,
        selectedChunk2CDs,
        selectedChunks,
        status: "gathering_cds",
        working_on: "step_1"
      };

      const progressData = {
        assignment_id: assignment.id,
        student_id: studentProfile.id,
        concrete_details: JSON.stringify(mergedData),
        status: "in_progress",
      };

      console.log("Saving CDs and selections:", progressData);

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

      alert(`✅ CDs saved successfully!`);
      
    } catch (error) {
      console.error("Error saving CDs:", error);
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

        {assignment.description && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">
              Assignment Instructions
            </h3>
            <p className="text-gray-700">{assignment.description}</p>
          </div>
        )}
      </div>

      {/* Main Form - GATHERING CDS */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
        {/* Argumentation Header with Icon and Help */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/argumentation01-circle-cmyk.jpg"
            alt="Argumentation"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            GATHERING CDS
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
          {/* Writing Prompt - Read Only for Reference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Argumentation Prompt
            </label>
            <div className="w-full px-4 py-3 border border-[#3d8c33] rounded-lg bg-[#3d8c33] text-white">
              {assignment.prompt || "No prompt provided"}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <p className="text-sm font-medium text-gray-700">
              Think of two or more possible concrete details (CDS) that would fit the prompt and write them below.
            </p>
          </div>

          {/* CDs for Chunk 1 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 uppercase">
              CDs for Chunk 1
            </h3>
            
            {/* Input for new CD */}
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                value={currentChunk1Input}
                onChange={(e) => setCurrentChunk1Input(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addChunk1CD()}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3d8c33] focus:border-[#3d8c33] text-[#13161f]"
                placeholder="Enter a concrete detail for chunk 1..."
              />
              <button
                onClick={addChunk1CD}
                className="px-6 py-3 bg-[#3d8c33] text-white rounded-lg hover:bg-[#2d6625] transition-colors font-medium"
              >
                Add CD
              </button>
            </div>

            {/* Display added CDs with drag-and-drop */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => handleDragEnd(event, 1)}
            >
              <SortableContext
                items={chunk1CDs.map((_, index) => `chunk1-${index}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {chunk1CDs.map((cd, index) => (
                    <SortableCDItem
                      key={`chunk1-${index}`}
                      id={`chunk1-${index}`}
                      cd={cd}
                      index={index}
                      isSelected={selectedChunk1CDs.includes(index)}
                      onSelect={() => selectChunk1CD(index)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* CDs for Chunk 2 - Only show if selectedChunks is 2 */}
          {selectedChunks === 2 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 uppercase">
                CDs for Chunk 2
              </h3>
              
              {/* Input for new CD */}
              <div className="flex gap-3 mb-4">
                <input
                  type="text"
                  value={currentChunk2Input}
                  onChange={(e) => setCurrentChunk2Input(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addChunk2CD()}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3d8c33] focus:border-[#3d8c33] text-[#13161f]"
                  placeholder="Enter a concrete detail for chunk 2..."
                />
                <button
                  onClick={addChunk2CD}
                  className="px-6 py-3 bg-[#3d8c33] text-white rounded-lg hover:bg-[#2d6625] transition-colors font-medium"
                >
                  Add CD
                </button>
              </div>

              {/* Display added CDs with drag-and-drop */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => handleDragEnd(event, 2)}
              >
                <SortableContext
                  items={chunk2CDs.map((_, index) => `chunk2-${index}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {chunk2CDs.map((cd, index) => (
                      <SortableCDItem
                        key={`chunk2-${index}`}
                        id={`chunk2-${index}`}
                        cd={cd}
                        index={index}
                      isSelected={selectedChunk2CDs.includes(index)}
                        onSelect={() => selectChunk2CD(index)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* Selection Instructions */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Click multiple CDs that you want to use for your argument.
            </h3>
            <p className="text-gray-700">
              You can select multiple concrete details for each chunk. Click or tap "Save and Next" when you have selected your CDs.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-12">
          <Link
            href={`/dashboard/assignments/${assignment.id}/start`}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Back
          </Link>

          <button
            onClick={handleSave}
            disabled={saving || submitting}
            className="px-6 py-3 bg-[#13161f] text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : "Save"}
          </button>

          <button
            onClick={async () => {
              await handleSave();
              if (!saving) {
                router.push(`/dashboard/assignments/${assignment.id}/decisions`);
              }
            }}
            disabled={saving || submitting}
            className="px-6 py-3 bg-[#3d8c33] text-white rounded-lg hover:bg-[#2d6625] disabled:opacity-50 transition-colors font-medium"
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
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-[#3d8c33]">Gathering CDS</div>
            <div className="text-sm text-[#3d8c33]">Current Step</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              17%
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
              <h3 className="text-xl font-bold text-gray-900">GATHERING CDS Tips</h3>
              <button
                onClick={() => setShowTipModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 text-gray-700">
              <div>
                <span className="font-semibold text-[#3d8c33]">1.</span> LIST AND ADD 3-5 concrete details (CDs), but you may also add as many as you like. You may click the Add CD button or press Enter to add CDs.
              </div>
              
              <div>
                <span className="font-semibold text-[#3d8c33]">2.</span> You may list several and then combine them into one sentence on a CD line and select that one.
              </div>
              
              <div>
                <span className="font-semibold text-[#3d8c33]">3.</span> HIGHLIGHT the one line of CDs that you want to use for each chunk. Remember, for argumentation, this step helps you select the evidence you want to use for your argument.
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
