// components/dashboard/assignments/NarrativeShapingSheetForm.tsx
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
  };
}

interface NarrativeShapingSheetFormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

interface ProgressData {
  assignment_id: string;
  student_id: string;
  working_on: string;
  notes: any;
  status: string;
  writing_style: string;
  last_saved: string;
}

export default function NarrativeShapingSheetForm({
  assignment,
  studentProfile,
}: NarrativeShapingSheetFormProps) {
  const router = useRouter();
  const [currentSheet, setCurrentSheet] = useState(1);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const loadProgress = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          setProgress(data.data);
          // Determine which sheet to show based on progress
          const notes = data.data.notes || {};
          if (notes.sheet3 && Object.keys(notes.sheet3).length > 0) {
            setCurrentSheet(3);
          } else if (notes.sheet2 && Object.keys(notes.sheet2).length > 0) {
            setCurrentSheet(2);
          } else {
            setCurrentSheet(1);
          }
        }
      }
    } catch (error) {
      console.error("Error loading progress:", error);
    }
  }, [assignment.id, studentProfile.id]);

  // Load existing progress
  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const saveProgress = useCallback(
    async (updatedNotes: any) => {
      if (saving) return;

      setSaving(true);
      setSaveStatus("saving");

      try {
        const progressData = {
          assignment_id: assignment.id,
          student_id: studentProfile.id,
          working_on: "shaping",
          notes: updatedNotes,
          writing_style: "narrative",
          status: "in_progress",
        };

        const response = await fetch("/api/student-progress", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(progressData),
        });

        if (response.ok) {
          const result = await response.json();
          setProgress(result.data);
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        }
      } catch (error) {
        console.error("Error saving progress:", error);
      } finally {
        setSaving(false);
      }
    },
    [assignment.id, studentProfile.id, saving]
  );

  const renderSheet = () => {
    switch (currentSheet) {
      case 1:
        return renderSheet1();
      case 2:
        return renderSheet2();
      case 3:
        return renderSheet3();
      default:
        return renderSheet1();
    }
  };

  const renderSheet1 = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">Narrative Shaping Sheet 1: Event Selection</h3>
        <p className="text-blue-700">
          Choose a significant event or experience that had an impact on your life. This will be the foundation of your narrative.
        </p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Describe the event or experience you want to write about:
          </label>
          <textarea
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={4}
            placeholder="Describe your chosen event or experience..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Why is this event significant to you?
          </label>
          <textarea
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            placeholder="Explain why this event is meaningful..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What lesson or insight did you gain from this experience?
          </label>
          <textarea
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            placeholder="Describe what you learned..."
          />
        </div>
      </div>
    </div>
  );

  const renderSheet2 = () => (
    <div className="space-y-6">
      <div className="bg-green-50 p-4 rounded-lg">
        <h3 className="font-semibold text-green-800 mb-2">Narrative Shaping Sheet 2: Character Development</h3>
        <p className="text-green-700">
          Develop the key characters in your narrative, including yourself and others who played important roles.
        </p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Describe yourself at the time of this event:
          </label>
          <textarea
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            rows={3}
            placeholder="How would you describe yourself during this time?"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Who else was involved? Describe the other important people:
          </label>
          <textarea
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            rows={4}
            placeholder="Describe the other people involved..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            How did the relationships between characters affect the outcome?
          </label>
          <textarea
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            rows={3}
            placeholder="Explain the role of relationships..."
          />
        </div>
      </div>
    </div>
  );

  const renderSheet3 = () => (
    <div className="space-y-6">
      <div className="bg-purple-50 p-4 rounded-lg">
        <h3 className="font-semibold text-purple-800 mb-2">Narrative Shaping Sheet 3: Structure & Timeline</h3>
        <p className="text-purple-700">
          Organize the sequence of events and plan how you'll structure your narrative.
        </p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Beginning: How will you start your story?
          </label>
          <textarea
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            rows={3}
            placeholder="Describe your opening..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Middle: What are the key events in chronological order?
          </label>
          <textarea
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            rows={4}
            placeholder="List the main events in order..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            End: How will you conclude and reflect on the experience?
          </label>
          <textarea
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            rows={3}
            placeholder="Describe your conclusion..."
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <Link
            href={`/dashboard/assignments/${assignment.id}`}
            className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Assignment
          </Link>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-sm text-gray-500">
              {saveStatus === "saving" && (
                <>
                  <Clock className="h-4 w-4 mr-1 animate-spin" />
                  Saving...
                </>
              )}
              {saveStatus === "saved" && (
                <span className="text-green-600">✓ Saved</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {assignment.title} - Narrative Shaping
            </h1>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center">
                <User className="h-4 w-4 mr-1" />
                {assignment.user_profiles?.first_name} {assignment.user_profiles?.last_name}
              </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                Due: {new Date(assignment.due_date).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sheet Navigation */}
      <div className="flex mb-8 border-b border-gray-200">
        {[1, 2, 3].map((sheet) => (
          <button
            key={sheet}
            onClick={() => setCurrentSheet(sheet)}
            className={`px-6 py-3 font-medium text-sm transition-colors ${
              currentSheet === sheet
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Sheet {sheet}
          </button>
        ))}
      </div>

      {/* Current Sheet */}
      {renderSheet()}

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
        <button
          onClick={() => setCurrentSheet(Math.max(1, currentSheet - 1))}
          disabled={currentSheet === 1}
          className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Previous Sheet
        </button>
        
        <div className="text-sm text-gray-500">
          Sheet {currentSheet} of 3
        </div>
        
        {currentSheet < 3 ? (
          <button
            onClick={() => setCurrentSheet(Math.min(3, currentSheet + 1))}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Next Sheet
          </button>
        ) : (
          <Link
            href={`/dashboard/assignments/${assignment.id}/body-paragraphs`}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Continue to Body Paragraphs
          </Link>
        )}
      </div>
    </div>
  );
}