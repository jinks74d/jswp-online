"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSingleSheetShapingConfig } from '@/lib/assignment-configs';
import type { UserProfile } from '@/lib/supabase';
import type { WritingStyleShapingConfig, ShapingField } from '@/lib/assignment-configs/types';

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

interface UnifiedSingleSheetFormProps {
  assignment: Assignment;
  studentProfile: UserProfile & {
    districts?: { id: string; name: string };
    schools?: { id: string; name: string };
  };
}

interface FormData {
  [key: string]: any;
}

export default function UnifiedSingleSheetForm({
  assignment,
  studentProfile,
}: UnifiedSingleSheetFormProps) {
  const router = useRouter();
  const config = getSingleSheetShapingConfig(assignment.writing_style) as WritingStyleShapingConfig;

  // State for all possible fields
  const [formData, setFormData] = useState<FormData>({});
  const [selectedChunks, setSelectedChunks] = useState(1);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showTipModal, setShowTipModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Auto-save functionality with debouncing
  const debouncedAutoSave = useCallback(
    async (data: FormData) => {
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
          [config.behavior.saveKey]: data,
          selectedChunks: selectedChunks,
          status: 'shaping',
          working_on: 'shaping',
        };

        const response = await fetch('/api/student-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignment_id: assignment.id,
            student_id: studentProfile.id,
            concrete_details: JSON.stringify(mergedData),
            writing_style: assignment.writing_style,
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
    [assignment.id, assignment.writing_style, studentProfile.id, config.behavior.saveKey, selectedChunks]
  );

  // Load data from previous step on component mount
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
            console.log('Loading shaping sheet data:', stepData);

            // Load from the configured save key first
            const savedData = stepData[config.behavior.saveKey];
            if (savedData) {
              setFormData(savedData);
              if (stepData.selectedChunks) {
                setSelectedChunks(stepData.selectedChunks);
              }
            } else if (config.behavior.dataSource) {
              // Load from data source if specified
              const dataSource = config.behavior.dataSource;
              
              if (typeof dataSource === 'string') {
                // Simple string data source
                const sourceData = stepData[dataSource];
                if (sourceData) {
                  setFormData(sourceData);
                }
              } else {
                // Complex data source with field mappings
                const sourceData = stepData[dataSource.stepKey];
                if (sourceData && dataSource.fieldMappings) {
                  const mappedData: FormData = {};
                  
                  // Map fields from source to form
                  Object.entries(dataSource.fieldMappings).forEach(([formField, sourceField]) => {
                    if (sourceData[sourceField as keyof typeof sourceData]) {
                      mappedData[formField] = sourceData[sourceField as keyof typeof sourceData];
                    }
                  });

                  // Special handling for concrete details array
                  if (sourceData.selectedCDs) {
                    mappedData.concreteDetails = sourceData.selectedCDs;
                  } else if (sourceData.concreteDetails) {
                    mappedData.concreteDetails = sourceData.concreteDetails;
                  }

                  setFormData(mappedData);
                }
              }
            }

            // Load selectedChunks for conditional rendering
            if (stepData.selectedChunks) {
              setSelectedChunks(stepData.selectedChunks);
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
  }, [assignment.id, studentProfile.id, config.behavior.dataSource, config.behavior.saveKey]);

  // Auto-save when data changes
  useEffect(() => {
    if (!loading && Object.keys(formData).length > 0) {
      const timeoutId = setTimeout(() => {
        debouncedAutoSave(formData);
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [formData, loading, debouncedAutoSave]);

  // Check if field should be displayed based on conditional
  const shouldShowField = (field: ShapingField): boolean => {
    if (!field.conditional) return true;

    const { field: condField, operator, value } = field.conditional;
    const condValue = condField === 'selectedChunks' ? selectedChunks : formData[condField];

    switch (operator) {
      case '===':
        return condValue === value;
      case '!==':
        return condValue !== value;
      case '>':
        return condValue > value;
      case '<':
        return condValue < value;
      case '>=':
        return condValue >= value;
      case '<=':
        return condValue <= value;
      default:
        return true;
    }
  };

  // Get field styling based on field type and key
  const getFieldStyling = (field: ShapingField) => {
    const key = field.key;
    
    // TS fields (Topic Sentence)
    if (key === 'topicSentence') {
      return {
        headerStyle: {
          clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)",
          backgroundColor: "#2563eb",
          color: "white",
          padding: "12px 32px",
          fontWeight: "bold",
          fontSize: "18px",
          minWidth: "120px",
          textAlign: "center" as const,
        },
        containerClass: "text-center",
        wrapperClass: "inline-block",
        contentClass: "p-6 border-2 border-blue-600 rounded-b-lg bg-blue-50 min-w-[600px]",
        textareaClass: "w-full px-3 py-2 border-0 focus:outline-none text-blue-800 bg-transparent resize-none text-base",
        label: "TS"
      };
    }
    
    // CD fields (Concrete Details)
    if (key.includes('CD') || key.includes('concreteDetails')) {
      return {
        headerClass: "bg-[#b3172c] text-white px-8 py-3 rounded-t-lg font-bold text-lg",
        containerClass: "text-center",
        wrapperClass: "inline-block",
        contentClass: "p-6 border-2 border-[#b3172c] bg-red-50 min-w-[600px] border-t-0",
        textareaClass: "w-full px-3 py-2 border-0 focus:outline-none text-red-800 bg-transparent resize-none text-base",
        label: "CD"
      };
    }
    
    // CM fields (Commentary)
    if (key.includes('CM') || key.includes('commentary')) {
      return {
        headerStyle: {
          borderRadius: "50px",
          backgroundColor: "#16a34a",
          color: "white",
          padding: "16px 48px",
          fontWeight: "bold",
          fontSize: "18px",
          minWidth: "120px",
          textAlign: "center" as const,
        },
        containerClass: "text-center",
        wrapperClass: "relative mb-4",
        outerWrapperClass: "mx-auto",
        contentClass: "p-6 border-2 border-green-600 rounded-lg bg-green-50 min-w-[600px]",
        textareaClass: "w-full px-3 py-2 border-0 focus:outline-none text-green-800 bg-transparent resize-none text-base",
        label: "CM"
      };
    }
    
    // CS fields (Concluding Sentence)
    if (key === 'concludingSentence') {
      return {
        headerStyle: {
          clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)",
          backgroundColor: "#2563eb",
          color: "white",
          padding: "12px 32px",
          fontWeight: "bold",
          fontSize: "18px",
          minWidth: "120px",
          textAlign: "center" as const,
        },
        containerClass: "text-center",
        wrapperClass: "inline-block",
        contentClass: "p-6 border-2 border-blue-600 rounded-b-lg bg-blue-50 min-w-[600px]",
        textareaClass: "w-full px-3 py-2 border-0 focus:outline-none text-blue-800 bg-transparent resize-none text-base",
        label: "CS"
      };
    }
    
    // Default styling for other fields
    return null;
  };

  // Field renderer
  const renderField = (field: ShapingField) => {
    if (!shouldShowField(field)) return null;

    const value = formData[field.key] || '';
    const styling = getFieldStyling(field);

    switch (field.type) {
      case 'textarea':
        // Use styled component if styling is defined
        if (styling) {
          return (
            <div key={field.key} className="mb-6">
              <div className={styling.containerClass}>
                <div className={styling.wrapperClass}>
                  {styling.headerStyle ? (
                    <div className="relative">
                      <div style={styling.headerStyle}>
                        {styling.label}
                      </div>
                    </div>
                  ) : styling.headerClass ? (
                    <div className={styling.headerClass}>
                      {styling.label}
                    </div>
                  ) : null}
                  <div className={styling.contentClass}>
                    <textarea
                      value={value}
                      onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      rows={field.rows || 3}
                      disabled={field.readonly}
                      className={styling.textareaClass}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        }
        
        // Default textarea styling
        return (
          <div key={field.key} className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              value={value}
              onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
              placeholder={field.placeholder}
              rows={field.rows || 3}
              disabled={field.readonly}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-base ${
                field.readonly ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
              }`}
            />
          </div>
        );
      
      case 'text':
        return (
          <div key={field.key} className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
              placeholder={field.placeholder}
              disabled={field.readonly}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-base ${
                field.readonly ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
              }`}
            />
          </div>
        );
      
      case 'cd-array':
        const cds = Array.isArray(value) ? value : [];
        return (
          <div key={field.key} className="mb-6">
            <div className="text-center">
              <div className="inline-block">
                <div className="bg-[#b3172c] text-white px-8 py-3 rounded-t-lg font-bold text-lg">
                  CD
                </div>
                <div className="p-6 border-2 border-[#b3172c] bg-red-50 min-w-[600px] border-t-0">
                  {cds.length > 0 ? (
                    <ul className="space-y-2">
                      {cds.map((cd: string, index: number) => (
                        <li key={index} className="flex items-start">
                          <span className="text-red-600 font-semibold mr-2">{index + 1}.</span>
                          <span className="text-gray-700">{cd}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 italic">No concrete details available</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validate form
    const validationResult = config.validation.validateSubmit(formData);
    if (!validationResult.valid) {
      alert(validationResult.message);
      return;
    }

    setSaving(true);
    try {
      // Save data
      await debouncedAutoSave(formData);
      
      // Navigate to next step
      const nextRoute = config.navigation.nextRoute.replace('[id]', assignment.id);
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
    const backRoute = config.navigation.backRoute.replace('[id]', assignment.id);
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
          <h1 className="text-2xl font-bold text-gray-900">{config.ui.pageTitle}</h1>
          <p className="mt-2 text-gray-600">{config.ui.instructionText}</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            {config.behavior.fields.map(field => renderField(field))}

            {/* Buttons */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t">
              <button
                type="button"
                onClick={handleBack}
                className="px-6 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {config.ui.buttons.back || 'Back'}
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
                {config.ui.helpText && (
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
                  {saving ? 'Saving...' : (config.ui.buttons.next || 'Save and Next')}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Help Modal */}
        {showTipModal && config.ui.helpText && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-bold text-gray-900">
                    {config.ui.helpText.title}
                  </h2>
                  <button
                    onClick={() => setShowTipModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-4">
                  {config.ui.helpText.sections.map((section, index) => (
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