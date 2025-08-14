// components/dashboard/assignments/WritingStyleSelection.tsx
"use client";

import { useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRole } from "@/lib/supabase";

interface WritingStyle {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

interface WritingStyleSelectionProps {
  currentUserRole: UserRole;
  currentUserSchool?: { id: string; name: string } | null;
  districtName: string;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
}

const writingStyles: WritingStyle[] = [
  {
    id: "literary",
    name: "Literary",
    description: "Creative writing focused on literary elements, character development, and artistic expression",
    icon: "/assets/literary01-circle-cmyk.jpg",
    color: "border-[#b3172c]/30 hover:border-[#b3172c]/50 hover:bg-[#b3172c]/5",
  },
  {
    id: "expository",
    name: "Expository/Informal",
    description: "Informative writing that explains, describes, or provides information in a clear, organized manner",
    icon: "/assets/expository01-circle-cmyk.jpg",
    color: "border-[#22356d]/30 hover:border-[#22356d]/50 hover:bg-[#22356d]/5",
  },
  {
    id: "argumentation",
    name: "Argumentation",
    description: "Persuasive writing that presents claims, evidence, and reasoning to convince readers",
    icon: "/assets/argumentation01-circle-cmyk.jpg",
    color: "border-[#3d8c33]/30 hover:border-[#3d8c33]/50 hover:bg-[#3d8c33]/5",
  },
  {
    id: "narrative",
    name: "Narrative",
    description: "Storytelling that recounts events, experiences, or sequences in chronological order",
    icon: "/assets/narrative01-circle-cmyk.jpg",
    color: "border-[#13161f]/30 hover:border-[#13161f]/50 hover:bg-[#13161f]/5",
  },
];

export default function WritingStyleSelection({
  currentUserRole,
  currentUserSchool,
  districtName,
  logo_url,
  primary_color,
  secondary_color,
}: WritingStyleSelectionProps) {
  const router = useRouter();
  const [selectedStyle, setSelectedStyle] = useState<string>("");

  // District branding
  const districtSecondaryColor = secondary_color || '#0B2559';

  const handleStyleSelect = (styleId: string) => {
    setSelectedStyle(styleId);
  };

  const handleContinue = () => {
    if (selectedStyle) {
      router.push(`/dashboard/assignments/create/${selectedStyle}`);
    }
  };

  const getPageTitle = () => {
    if (currentUserRole === "district_admin") {
      return "Create New Assignment";
    } else if (currentUserRole === "school_admin") {
      return "Create School Assignment";
    } else {
      return "Create Assignment";
    }
  };

  const getPageDescription = () => {
    if (currentUserRole === "district_admin") {
      return `Create a new writing assignment for ${districtName}`;
    } else if (currentUserRole === "school_admin") {
      return `Create a new writing assignment for ${currentUserSchool?.name}`;
    } else {
      return `Create a new writing assignment for your students at ${currentUserSchool?.name}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/assignments"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Assignments
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">{getPageTitle()}</h1>
        <p className="text-gray-600 mt-1">{getPageDescription()}</p>
      </div>

      {/* Writing Style Selection */}
      <div 
        className="bg-white rounded-lg shadow-sm border-2 p-8"
        style={{ border: `2px solid ${districtSecondaryColor}` }}
      >
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Choose a Writing Style
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Select the type of writing assignment you want to create. Each style has its own unique set of forms 
            that will guide students through the writing process step by step.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {writingStyles.map((style) => (
            <button
              key={style.id}
              onClick={() => handleStyleSelect(style.id)}
              className={`group relative p-6 border-2 rounded-xl transition-all duration-200 text-left ${style.color} ${
                selectedStyle === style.id 
                  ? "ring-2 ring-blue-500 ring-offset-2" 
                  : ""
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <img
                    src={style.icon}
                    alt={style.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {style.name}
                    </h3>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {style.description}
                  </p>
                </div>
              </div>

              {/* Selection indicator */}
              {selectedStyle === style.id && (
                <div className="absolute top-3 right-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Continue Button */}
        {selectedStyle && (
          <div className="mt-8 text-center">
            <button
              onClick={handleContinue}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Continue with {writingStyles.find(s => s.id === selectedStyle)?.name}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Information Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              How Writing Assignments Work
            </h3>
            <div className="text-blue-800 space-y-2 text-sm">
              <p>
                <strong>Multi-Form Process:</strong> Each writing style consists of multiple forms that guide students through the writing process step by step.
              </p>
              <p>
                <strong>Auto-Save:</strong> Student progress is automatically saved as they move between forms, so they never lose their work.
              </p>
              <p>
                <strong>Data Flow:</strong> Information from previous forms automatically populates relevant fields in subsequent forms, reducing repetitive work.
              </p>
              <p>
                <strong>Progressive Building:</strong> Students build their writing piece gradually, with each form focusing on specific aspects of the writing style.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Writing Style Status */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Available Writing Styles
          </h3>
          <p className="text-gray-600 mb-4">
            Select any writing style above to create a new assignment. Each style includes a complete set of forms
            that guide students through the writing process using the Jane Schaffer methodology.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#b3172c' }}></div>
              <span>Literary Analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#22356d' }}></div>
              <span>Expository Writing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3d8c33' }}></div>
              <span>Argumentation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#13161f' }}></div>
              <span>Narrative Writing</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
