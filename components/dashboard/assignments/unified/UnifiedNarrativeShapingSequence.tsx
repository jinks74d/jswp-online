"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getNarrativeShapingSequenceConfig } from '@/lib/assignment-configs';
import { SafeHTML } from '@/lib/sanitization';
import type { UserProfile } from '@/lib/supabase';
import type { WritingStyleShapingConfig } from '@/lib/assignment-configs/types';

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

interface UnifiedNarrativeShapingSequenceProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
  sheetNumber: 1 | 2 | 3;
}

interface ShapingSheetData {
  topicSentence: string;
  concreteDetails: string[];
  commentary: string;
  concludingSentence: string;
  assembledParagraph: string;
}

export default function UnifiedNarrativeShapingSequence({
  assignment,
  studentProfile,
  sheetNumber,
}: UnifiedNarrativeShapingSequenceProps) {
  const router = useRouter();
  const sequenceConfig = getNarrativeShapingSequenceConfig();
  const sheetConfig = sequenceConfig.sheets[`sheet${sheetNumber}`] as WritingStyleShapingConfig;

  // State
  const [formData, setFormData] = useState<ShapingSheetData>({
    topicSentence: '',
    concreteDetails: [],
    commentary: '',
    concludingSentence: '',
    assembledParagraph: '',
  });
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showTipModal, setShowTipModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Auto-assemble color-coded paragraph
  const assembleColorCodedParagraph = useCallback((data: ShapingSheetData) => {
    const parts = [];

    if (data.topicSentence.trim()) {
      parts.push(`<span style="color: #2563eb; font-weight: 600;">${data.topicSentence.trim()}</span>`);
    }

    data.concreteDetails.forEach(cd => {
      if (cd.trim()) {
        parts.push(`<span style="color: #dc2626; font-weight: 600;">${cd.trim()}</span>`);
      }
    });

    if (data.commentary.trim()) {
      parts.push(`<span style="color: #16a34a; font-weight: 600;">${data.commentary.trim()}</span>`);
    }

    if (data.concludingSentence.trim()) {
      parts.push(`<span style="color: #2563eb; font-weight: 600;">${data.concludingSentence.trim()}</span>`);
    }

    return parts.join(' ');
  }, []);

  // Auto-save functionality with debouncing
  const debouncedAutoSave = useCallback(
    async (data: ShapingSheetData) => {
      setAutoSaveStatus('saving');
      try {
        // Get existing data
        const existingResponse = await fetch(
          `/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`
        );
        const existingResult = await existingResponse.json();

        let existingStepData = {};
        if (existingResponse.ok && existingResult.data?.concrete_details) {
          try {
            existingStepData = JSON.parse(existingResult.data.concrete_details);
          } catch {
            console.log('No existing data to preserve');
          }
        }

        // Merge data with existing data
        const mergedData = {
          ...existingStepData,
          [sheetConfig.behavior.saveKey]: {
            topicSentence: data.topicSentence,
            concreteDetails: data.concreteDetails,
            commentary: data.commentary,
            concludingSentence: data.concludingSentence,
            assembledParagraph: data.assembledParagraph,
          },
          status: `shaping_sheet_${sheetNumber}`,
          working_on: `shaping_sheet_${sheetNumber}`,
        };

        const response = await fetch('/api/student-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignment_id: assignment.id,
            student_id: studentProfile.id,
            concrete_details: JSON.stringify(mergedData),
            writing_style: 'narrative',
          }),
        });

        if (response.ok) {
          setAutoSaveStatus('saved');
          setTimeout(() => setAutoSaveStatus('idle'), 2000);
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
        setAutoSaveStatus('idle');
      }
    },
    [assignment.id, studentProfile.id, sheetConfig.behavior.saveKey, sheetNumber]
  );

  // Load previous data on component mount
  useEffect(() => {
    const loadPreviousData = async () => {
      try {
        const response = await fetch(
          `/api/student-progress?assignment_id=${assignment.id}&student_id=${studentProfile.id}`
        );
        const result = await response.json();

        if (response.ok && result.data?.concrete_details) {
          try {
            const stepData = JSON.parse(result.data.concrete_details);
            console.log(`Loading Narrative Shaping Sheet ${sheetNumber} data:`, stepData);

            // Initialize default data
            let topicSentence = '';
            let concreteDetails: string[] = [];
            let commentary = '';
            let concludingSentence = '';

            // Load existing topic sentence if available
            if (stepData.topicSentence) {
              topicSentence = stepData.topicSentence;
            }

            // Load CDs from T-Chart data based on sheet number
            if (stepData.tChartData) {
              const tChartData = stepData.tChartData;
              const cds: string[] = [];

              if (sheetNumber === 1) {
                // Sheet 1: When/Where/Who
                if (tChartData.when_cd) cds.push(tChartData.when_cd);
                if (tChartData.where_cd) cds.push(tChartData.where_cd);
                if (tChartData.who_cd) cds.push(tChartData.who_cd);
              } else if (sheetNumber === 2) {
                // Sheet 2: What happened
                if (tChartData.what_cd) cds.push(tChartData.what_cd);
                if (tChartData.dialogue_cd) cds.push(tChartData.dialogue_cd);
              } else if (sheetNumber === 3) {
                // Sheet 3: Why/How/Impact
                if (tChartData.why_cd) cds.push(tChartData.why_cd);
                if (tChartData.how_cd) cds.push(tChartData.how_cd);
                if (tChartData.impact_cd) cds.push(tChartData.impact_cd);
              }

              concreteDetails = cds.filter(cd => cd && cd.trim());

              // Load corresponding commentary
              const cms: string[] = [];
              if (sheetNumber === 1) {
                if (tChartData.when_cm) cms.push(tChartData.when_cm);
                if (tChartData.where_cm) cms.push(tChartData.where_cm);
                if (tChartData.who_cm) cms.push(tChartData.who_cm);
              } else if (sheetNumber === 2) {
                if (tChartData.what_cm) cms.push(tChartData.what_cm);
                if (tChartData.dialogue_cm) cms.push(tChartData.dialogue_cm);
              } else if (sheetNumber === 3) {
                if (tChartData.why_cm) cms.push(tChartData.why_cm);
                if (tChartData.how_cm) cms.push(tChartData.how_cm);
                if (tChartData.impact_cm) cms.push(tChartData.impact_cm);
              }

              commentary = cms.filter(cm => cm && cm.trim()).join(' ');
            }

            // Prioritize existing shaping sheet data if available
            const savedData = stepData[sheetConfig.behavior.saveKey];
            if (savedData) {
              setFormData({
                topicSentence: savedData.topicSentence || topicSentence,
                concreteDetails: savedData.concreteDetails || concreteDetails,
                commentary: savedData.commentary || commentary,
                concludingSentence: savedData.concludingSentence || concludingSentence,
                assembledParagraph: savedData.assembledParagraph || '',
              });
            } else {
              setFormData({
                topicSentence,
                concreteDetails,
                commentary,
                concludingSentence,
                assembledParagraph: '',
              });
            }
          } catch (error) {
            console.error('Error parsing step data:', error);
          }
        }
      } catch (error) {
        console.error('Error loading previous data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPreviousData();
  }, [assignment.id, studentProfile.id, sheetConfig.behavior.saveKey, sheetNumber]);

  // Auto-update assembledParagraph when form data changes
  useEffect(() => {
    if (sheetConfig.behavior.autoAssembleParagraph) {
      const assembled = assembleColorCodedParagraph(formData);
      if (assembled !== formData.assembledParagraph) {
        setFormData(prev => ({ ...prev, assembledParagraph: assembled }));
      }
    }
  }, [
    formData.topicSentence,
    formData.concreteDetails,
    formData.commentary,
    formData.concludingSentence,
    assembleColorCodedParagraph,
    sheetConfig.behavior.autoAssembleParagraph,
  ]);

  // Auto-save when data changes
  useEffect(() => {
    if (!loading && (
      formData.topicSentence.trim() ||
      formData.concreteDetails.length > 0 ||
      formData.commentary.trim() ||
      formData.concludingSentence.trim()
    )) {
      const timeoutId = setTimeout(() => {
        debouncedAutoSave(formData);
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [formData, loading, debouncedAutoSave]);

  // Handle form submission
  const handleSubmit = async () => {
    // Validate form
    const validationResult = sheetConfig.validation.validateSubmit(formData);
    if (!validationResult.valid) {
      alert(validationResult.message);
      return;
    }

    setSaving(true);
    try {
      // Save data
      await debouncedAutoSave(formData);

      // Navigate to next step
      const nextRoute = sheetConfig.navigation.nextRoute.replace('[id]', assignment.id);
      router.push(nextRoute);
    } catch (error) {
      console.error('Error saving data:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    const backRoute = sheetConfig.navigation.backRoute.replace('[id]', assignment.id);
    router.push(backRoute);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{sheetConfig.ui.pageTitle}</h1>
          <p className="mt-2 text-gray-600">{sheetConfig.ui.instructionText}</p>
          
          {/* Sheet Progress Indicator */}
          <div className="mt-4 flex items-center space-x-2">
            {[1, 2, 3].map((num) => (
              <div
                key={num}
                className={`flex-1 h-2 rounded-full ${
                  num === sheetNumber
                    ? 'bg-blue-600'
                    : num < sheetNumber
                    ? 'bg-blue-400'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            {/* Topic Sentence */}
            <div className="mb-6">
              <div className="text-center">
                <div className="inline-block">
                  {/* TS Header - Pentagon/Trapezoid Shape */}
                  <div className="relative">
                    <div
                      className="bg-blue-600 text-white px-8 py-3 font-bold text-lg"
                      style={{
                        clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)",
                        minWidth: "120px",
                        textAlign: "center",
                      }}
                    >
                      TS
                    </div>
                  </div>
                  <div className="p-6 border-2 border-blue-600 rounded-b-lg bg-blue-50 min-w-[600px]">
                    <textarea
                      value={formData.topicSentence}
                      onChange={(e) => setFormData(prev => ({ ...prev, topicSentence: e.target.value }))}
                      placeholder="Enter your topic sentence..."
                      rows={3}
                      className="w-full px-3 py-2 border-0 focus:outline-none text-blue-800 bg-transparent resize-none text-base"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Concrete Details */}
            <div className="mb-6">
              <div className="text-center">
                <div className="inline-block">
                  <div className="bg-[#b3172c] text-white px-8 py-3 rounded-t-lg font-bold text-lg">
                    CD
                  </div>
                  <div className="p-6 border-2 border-[#b3172c] bg-red-50 min-w-[600px] border-t-0">
                    {formData.concreteDetails.length > 0 ? (
                      <ul className="space-y-2">
                        {formData.concreteDetails.map((cd, index) => (
                          <li key={index} className="flex items-start">
                            <span className="text-red-600 font-semibold mr-2">{index + 1}.</span>
                            <span className="text-gray-700">{cd}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 italic">No concrete details loaded from T-Chart</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Commentary */}
            <div className="mb-6">
              <div className="text-center">
                <div className="inline-block">
                  {/* CM Header - Oval Shape */}
                  <div className="relative mb-4">
                    <div
                      className="bg-green-600 text-white px-12 py-4 font-bold text-lg mx-auto"
                      style={{
                        borderRadius: "50px",
                        minWidth: "120px",
                        textAlign: "center",
                      }}
                    >
                      CM
                    </div>
                  </div>
                  <div className="p-6 border-2 border-green-600 rounded-lg bg-green-50 min-w-[600px]">
                    <textarea
                      value={formData.commentary}
                      onChange={(e) => setFormData(prev => ({ ...prev, commentary: e.target.value }))}
                      placeholder="Add your commentary..."
                      rows={3}
                      className="w-full px-3 py-2 border-0 focus:outline-none text-green-800 bg-transparent resize-none text-base"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Concluding Sentence */}
            <div className="mb-6">
              <div className="text-center">
                <div className="inline-block">
                  {/* CS Header - Pentagon/Trapezoid Shape */}
                  <div className="relative">
                    <div
                      className="bg-blue-600 text-white px-8 py-3 font-bold text-lg"
                      style={{
                        clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)",
                        minWidth: "120px",
                        textAlign: "center",
                      }}
                    >
                      CS
                    </div>
                  </div>
                  <div className="p-6 border-2 border-blue-600 rounded-b-lg bg-blue-50 min-w-[600px]">
                    <textarea
                      value={formData.concludingSentence}
                      onChange={(e) => setFormData(prev => ({ ...prev, concludingSentence: e.target.value }))}
                      placeholder="Enter your concluding sentence..."
                      rows={3}
                      className="w-full px-3 py-2 border-0 focus:outline-none text-blue-800 bg-transparent resize-none text-base"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Assembled Paragraph Preview */}
            {sheetConfig.behavior.autoAssembleParagraph && formData.assembledParagraph && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assembled Paragraph Preview
                </label>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <SafeHTML content={formData.assembledParagraph} />
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  <div className="flex items-center space-x-4">
                    <span><span className="text-blue-600 font-semibold">Blue</span>: Topic & Concluding Sentences</span>
                    <span><span className="text-red-600 font-semibold">Red</span>: Concrete Details</span>
                    <span><span className="text-green-600 font-semibold">Green</span>: Commentary</span>
                  </div>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t">
              <button
                type="button"
                onClick={handleBack}
                className="px-6 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {sheetConfig.ui.buttons.back || 'Back'}
              </button>

              <div className="flex items-center space-x-4">
                {/* Auto-save status */}
                {autoSaveStatus === 'saving' && (
                  <span className="text-sm text-gray-500">Saving...</span>
                )}
                {autoSaveStatus === 'saved' && (
                  <span className="text-sm text-green-600">Saved</span>
                )}

                {/* Help button */}
                {sheetConfig.ui.helpText && (
                  <button
                    type="button"
                    onClick={() => setShowTipModal(true)}
                    className="px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    Tips
                  </button>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={saving}
                  className={`px-6 py-2 text-white rounded-lg transition-colors ${
                    saving
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {saving ? 'Saving...' : sheetConfig.ui.buttons.submit}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Help Modal */}
        {showTipModal && sheetConfig.ui.helpText && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-bold text-gray-900">
                    {sheetConfig.ui.helpText.title}
                  </h2>
                  <button
                    onClick={() => setShowTipModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  {sheetConfig.ui.helpText.sections.map((section, index) => (
                    <div key={index}>
                      <h3 className="font-semibold text-gray-800 mb-2">
                        {section.heading}
                      </h3>
                      <p className="text-gray-600">{section.content}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowTipModal(false)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}