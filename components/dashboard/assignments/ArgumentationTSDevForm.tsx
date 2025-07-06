// components/dashboard/assignments/ArgumentationTSDevForm.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Clock, User, HelpCircle, X, Plus, Trash2 } from "lucide-react";
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

interface TChartRow {
  id: string;
  cdNumbers: string;
  reason: string;
  isTS: boolean;
  isC: boolean;
  isCA: boolean;
  isR: boolean;
}

interface TChartData {
  positiveRows: TChartRow[];
  negativeRows: TChartRow[];
  selectedSide: 'positive' | 'negative' | '';
  selectedTopicSentence: string;
  selectedCounterargument: string;
}

interface ArgumentationTSDevFormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

export default function ArgumentationTSDevForm({
  assignment,
  studentProfile,
}: ArgumentationTSDevFormProps) {
  const router = useRouter();
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
  const [tChartData, setTChartData] = useState<TChartData>(() => {
    // Initialize with 8 empty rows on each side
    const initialPositiveRows: TChartRow[] = Array.from({ length: 8 }, (_, index) => ({
      id: `pos-${index}`,
      cdNumbers: '',
      reason: '',
      isTS: false,
      isC: false,
      isCA: false,
      isR: false
    }));

    const initialNegativeRows: TChartRow[] = Array.from({ length: 8 }, (_, index) => ({
      id: `neg-${index}`,
      cdNumbers: '',
      reason: '',
      isTS: false,
      isC: false,
      isCA: false,
      isR: false
    }));

    return {
      positiveRows: initialPositiveRows,
      negativeRows: initialNegativeRows,
      selectedSide: '',
      selectedTopicSentence: '',
      selectedCounterargument: ''
    };
  });
  const [newPositiveInput, setNewPositiveInput] = useState("");
  const [newNegativeInput, setNewNegativeInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

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
          step: 'topic_sentence_development',
          tChartData: data,
          status: "topic_sentence_development",
          working_on: "step_2"
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
      if (tChartData.positiveRows.length > 0 || tChartData.negativeRows.length > 0) {
        debouncedAutoSave(tChartData);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [tChartData, debouncedAutoSave]);

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
            
            // Load T-Chart data if returning to this step
            if (stepData.tChartData) {
              // Ensure we always have 8 rows, even when loading saved data
              const savedPositiveRows = stepData.tChartData.positiveRows || [];
              const savedNegativeRows = stepData.tChartData.negativeRows || [];
              
              // Fill up to 8 rows with saved data, then empty rows if needed
              const positiveRows = Array.from({ length: 8 }, (_, index) => {
                if (savedPositiveRows[index]) {
                  return savedPositiveRows[index];
                }
                return {
                  id: `pos-${index}`,
                  cdNumbers: '',
                  reason: '',
                  isTS: false,
                  isC: false,
                  isCA: false,
                  isR: false
                };
              });
              
              const negativeRows = Array.from({ length: 8 }, (_, index) => {
                if (savedNegativeRows[index]) {
                  return savedNegativeRows[index];
                }
                return {
                  id: `neg-${index}`,
                  cdNumbers: '',
                  reason: '',
                  isTS: false,
                  isC: false,
                  isCA: false,
                  isR: false
                };
              });
              
              setTChartData({
                positiveRows,
                negativeRows,
                selectedSide: stepData.tChartData.selectedSide || '',
                selectedTopicSentence: stepData.tChartData.selectedTopicSentence || '',
                selectedCounterargument: stepData.tChartData.selectedCounterargument || ''
              });
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

  // Initialize T-Chart with 8 rows on each side
  useEffect(() => {
    if (tChartData.positiveRows.length === 0 && tChartData.negativeRows.length === 0) {
      const initialPositiveRows: TChartRow[] = Array.from({ length: 8 }, (_, index) => ({
        id: `pos-${index}`,
        cdNumbers: '',
        reason: '',
        isTS: false,
        isC: false,
        isCA: false,
        isR: false
      }));

      const initialNegativeRows: TChartRow[] = Array.from({ length: 8 }, (_, index) => ({
        id: `neg-${index}`,
        cdNumbers: '',
        reason: '',
        isTS: false,
        isC: false,
        isCA: false,
        isR: false
      }));

      setTChartData(prev => ({
        ...prev,
        positiveRows: initialPositiveRows,
        negativeRows: initialNegativeRows
      }));
    }
  }, [tChartData.positiveRows.length, tChartData.negativeRows.length]);

  // T-Chart row management functions
  const addPositiveRow = () => {
    const newRow: TChartRow = {
      id: `pos-${Date.now()}`,
      cdNumbers: '',
      reason: '',
      isTS: false,
      isC: false,
      isCA: false,
      isR: false
    };
    setTChartData(prev => ({
      ...prev,
      positiveRows: [...prev.positiveRows, newRow]
    }));
  };

  const addNegativeRow = () => {
    const newRow: TChartRow = {
      id: `neg-${Date.now()}`,
      cdNumbers: '',
      reason: '',
      isTS: false,
      isC: false,
      isCA: false,
      isR: false
    };
    setTChartData(prev => ({
      ...prev,
      negativeRows: [...prev.negativeRows, newRow]
    }));
  };

  const updatePositiveRow = (id: string, field: keyof TChartRow, value: string | boolean) => {
    setTChartData(prev => ({
      ...prev,
      positiveRows: prev.positiveRows.map(row => 
        row.id === id ? { ...row, [field]: value } : row
      )
    }));
  };

  const updateNegativeRow = (id: string, field: keyof TChartRow, value: string | boolean) => {
    setTChartData(prev => ({
      ...prev,
      negativeRows: prev.negativeRows.map(row => 
        row.id === id ? { ...row, [field]: value } : row
      )
    }));
  };

  const removePositiveRow = (id: string) => {
    setTChartData(prev => ({
      ...prev,
      positiveRows: prev.positiveRows.filter(row => row.id !== id)
    }));
  };

  const removeNegativeRow = (id: string) => {
    setTChartData(prev => ({
      ...prev,
      negativeRows: prev.negativeRows.filter(row => row.id !== id)
    }));
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
        step: 'topic_sentence_development',
        tChartData,
        status: "topic_sentence_development",
        working_on: "step_2"
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

      alert(`✅ Topic Sentence Development saved successfully!`);
      
    } catch (error) {
      console.error("Error saving T-Chart:", error);
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
    // Check if CDs are selected AND at least one TS is marked
    const hasSelectedCDs = selectedCDs.selectedChunk1CDs.length > 0;
    const hasSelectedTS = [...tChartData.positiveRows, ...tChartData.negativeRows].some(row => row.isTS);
    return hasSelectedCDs && hasSelectedTS;
  };


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

      {/* Main Form - TOPIC SENTENCE DEVELOPMENT */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-6xl mx-auto">
        {/* Argumentation Header with Icon and Help */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/argumentation01-circle-cmyk.jpg"
            alt="Argumentation"
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            TOPIC SENTENCE DEVELOPMENT
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

          {/* Selected CDs from Previous Step */}
          <div className="bg-green-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-[#3d8c33] mb-4">
              Your Selected Concrete Details
            </h3>
            
            {/* Chunk 1 CDs */}
            {selectedCDs.chunk1CDs.length > 0 && (
              <div className="mb-6">
                <h4 className="text-md font-semibold text-[#2d6625] mb-3">Chunk 1 CDs:</h4>
                <div className="space-y-2">
                  {selectedCDs.selectedChunk1CDs.map((selectedIndex, displayIndex) => (
                    <div key={selectedIndex} className="flex items-start gap-3 p-3 bg-white rounded border border-[#3d8c33]">
                      <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded min-w-[24px] text-center">
                        {displayIndex + 1}
                      </span>
                      <p className="text-[#2d6625] flex-1">{selectedCDs.chunk1CDs[selectedIndex]}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Chunk 2 CDs */}
            {selectedCDs.chunk2CDs.length > 0 && selectedCDs.selectedChunk2CDs.length > 0 && (
              <div>
                <h4 className="text-md font-semibold text-[#2d6625] mb-3">Chunk 2 CDs:</h4>
                <div className="space-y-2">
                  {selectedCDs.selectedChunk2CDs.map((selectedIndex, displayIndex) => (
                    <div key={selectedIndex} className="flex items-start gap-3 p-3 bg-white rounded border border-[#3d8c33]">
                      <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded min-w-[24px] text-center">
                        {selectedCDs.selectedChunk1CDs.length + displayIndex + 1}
                      </span>
                      <p className="text-[#2d6625] flex-1">{selectedCDs.chunk2CDs[selectedIndex]}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Instructions Section */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              THE RED NUMBER(S) BELOW INDICATE THE CDS YOU ARE CONSIDERING.
            </h3>
            <ul className="text-gray-700 space-y-2 text-sm list-disc ml-6">
              <li>For each CD, provide at least one reason for it and one reason against it. The more reasons on each side, the better.</li>
              <li>DETERMINE which SIDE you are going to take and SELECT the best TS for YOUR SIDE.</li>
              <li>On the OPPOSING SIDE, select the Concession (C) and Counterargument (CA):
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>The CONCESSION (C) is the statement, with which both sides would agree. This statement is the "meeting of the minds."</li>
                  <li>The COUNTERARGUMENT (CA) is the statement, which you would anticipate your opponent to use as the best argument for the OPPOSING SIDE.</li>
                </ul>
              </li>
              <li>On YOUR SIDE, select the REFUTATION (R), which REFUTES the COUNTERARGUMENT.</li>
            </ul>
          </div>

          {/* T-Chart Section */}
          <div className="bg-white border-2 border-gray-300 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-2">
              <div className="bg-blue-100 p-4 border-r border-gray-300">
                <h3 className="text-lg font-bold text-blue-800 text-center">
                  FOR, PRO, AGREE, DEFEND
                </h3>
              </div>
              <div className="bg-red-100 p-4">
                <h3 className="text-lg font-bold text-red-800 text-center">
                  AGAINST, CON, DISAGREE, CHALLENGE
                </h3>
              </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-2 min-h-[400px]">
              {/* FOR Side */}
              <div className="p-4 border-r border-gray-300">
                <div className="space-y-3">
                  {(tChartData.positiveRows || []).map((row) => (
                    <div key={row.id} className="grid gap-1 items-center" style={{ gridTemplateColumns: '40px 1fr 30px 30px 30px 30px' }}>
                      {/* CD Numbers Input */}
                      <input
                        type="text"
                        value={row.cdNumbers}
                        onChange={(e) => updatePositiveRow(row.id, 'cdNumbers', e.target.value)}
                        className="w-full px-1 py-1 border border-gray-300 rounded text-center text-xs text-gray-900"
                        placeholder="#"
                      />
                      
                      {/* Reason Input */}
                      <input
                        type="text"
                        value={row.reason}
                        onChange={(e) => updatePositiveRow(row.id, 'reason', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-xs text-gray-900"
                        placeholder="Reason for..."
                      />
                      
                      {/* TS Button */}
                      <button
                        onClick={() => updatePositiveRow(row.id, 'isTS', !row.isTS)}
                        className={`px-1 py-1 text-xs font-bold rounded ${
                          row.isTS ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        TS
                      </button>
                      
                      {/* C Button */}
                      <button
                        onClick={() => updatePositiveRow(row.id, 'isC', !row.isC)}
                        className={`px-1 py-1 text-xs font-bold rounded ${
                          row.isC ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        C
                      </button>
                      
                      {/* CA Button */}
                      <button
                        onClick={() => updatePositiveRow(row.id, 'isCA', !row.isCA)}
                        className={`px-1 py-1 text-xs font-bold rounded ${
                          row.isCA ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        CA
                      </button>
                      
                      {/* R Button */}
                      <button
                        onClick={() => updatePositiveRow(row.id, 'isR', !row.isR)}
                        className={`px-1 py-1 text-xs font-bold rounded ${
                          row.isR ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        R
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* AGAINST Side */}
              <div className="p-4">
                <div className="space-y-3">
                  {(tChartData.negativeRows || []).map((row) => (
                    <div key={row.id} className="grid gap-1 items-center" style={{ gridTemplateColumns: '40px 1fr 30px 30px 30px 30px' }}>
                      {/* CD Numbers Input */}
                      <input
                        type="text"
                        value={row.cdNumbers}
                        onChange={(e) => updateNegativeRow(row.id, 'cdNumbers', e.target.value)}
                        className="w-full px-1 py-1 border border-gray-300 rounded text-center text-xs text-gray-900"
                        placeholder="#"
                      />
                      
                      {/* Reason Input */}
                      <input
                        type="text"
                        value={row.reason}
                        onChange={(e) => updateNegativeRow(row.id, 'reason', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-xs text-gray-900"
                        placeholder="Reason against..."
                      />
                      
                      {/* TS Button */}
                      <button
                        onClick={() => updateNegativeRow(row.id, 'isTS', !row.isTS)}
                        className={`px-1 py-1 text-xs font-bold rounded ${
                          row.isTS ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        TS
                      </button>
                      
                      {/* C Button */}
                      <button
                        onClick={() => updateNegativeRow(row.id, 'isC', !row.isC)}
                        className={`px-1 py-1 text-xs font-bold rounded ${
                          row.isC ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        C
                      </button>
                      
                      {/* CA Button */}
                      <button
                        onClick={() => updateNegativeRow(row.id, 'isCA', !row.isCA)}
                        className={`px-1 py-1 text-xs font-bold rounded ${
                          row.isCA ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        CA
                      </button>
                      
                      {/* R Button */}
                      <button
                        onClick={() => updateNegativeRow(row.id, 'isR', !row.isR)}
                        className={`px-1 py-1 text-xs font-bold rounded ${
                          row.isR ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        R
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
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
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-[#13161f] text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : "Save"}
          </button>

          <Link
            href={`/dashboard/assignments/${assignment.id}/working-topic-sentence`}
            onClick={async (e) => {
              e.preventDefault();
              await handleSave();
              if (!saving && canProceed()) {
                console.log('Navigating to:', `/dashboard/assignments/${assignment.id}/working-topic-sentence`);
                window.location.href = `/dashboard/assignments/${assignment.id}/working-topic-sentence`;
              } else if (!saving) {
                const hasSelectedCDs = selectedCDs.selectedChunk1CDs.length > 0;
                const hasSelectedTS = [...tChartData.positiveRows, ...tChartData.negativeRows].some(row => row.isTS);
                
                if (!hasSelectedCDs) {
                  alert("Please select at least one Concrete Detail from the previous step before proceeding.");
                } else if (!hasSelectedTS) {
                  alert("Please select a Topic Sentence (TS) by clicking the TS button next to one of your reasons in the T-Chart.");
                }
              }
            }}
            className={`inline-block px-6 py-3 rounded-lg font-medium transition-colors ${
              saving || !canProceed()
                ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                : "bg-[#3d8c33] text-white hover:bg-[#2d6625]"
            }`}
          >
            {saving ? "Saving..." : "Save and Next"}
          </Link>
        </div>
      </div>

      {/* Assignment Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Assignment Progress
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-[#3d8c33]">Topic Sentence Development</div>
            <div className="text-sm text-[#3d8c33]">Current Step</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              33%
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
              <h3 className="text-xl font-bold text-gray-900">Topic Sentence Development Tips</h3>
              <button
                onClick={() => setShowTipModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 text-gray-700">
              <div>
                <span className="font-semibold text-[#3d8c33]">1.</span> <strong>Brainstorm Positive Attributes:</strong> For your CD, think about what is positive, beneficial, or supportive about this evidence.
              </div>
              
              <div>
                <span className="font-semibold text-[#3d8c33]">2.</span> <strong>Brainstorm Negative Attributes:</strong> Consider what might be negative, problematic, or opposing about the same evidence.
              </div>
              
              <div>
                <span className="font-semibold text-[#3d8c33]">3.</span> <strong>Choose Your Side:</strong> Decide which side you can argue more effectively based on your evidence and the prompt.
              </div>

              <div>
                <span className="font-semibold text-[#3d8c33]">4.</span> <strong>Select Your Topic Sentence Idea:</strong> Pick the strongest point from your chosen side to build your main argument around.
              </div>

              <div>
                <span className="font-semibold text-[#3d8c33]">5.</span> <strong>Choose Your Counterargument:</strong> Select a point from the opposing side that you can address and refute in your paragraph.
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
