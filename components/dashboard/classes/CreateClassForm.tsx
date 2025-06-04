// components/dashboard/classes/CreateClassForm.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  ArrowLeft,
  BookOpen,
  Plus,
  ChevronDown,
  AlertCircle,
  Check,
} from "lucide-react";
import Link from "next/link";
import { UserProfile } from "@/lib/supabase";

interface Subject {
  id: string;
  name: string;
  description?: string;
  school_id: string;
  created_at: string;
}

interface ClassItem {
  id: string;
  name: string;
  subject_id: string;
  school_id: string;
  created_at: string;
}

interface CreateClassFormProps {
  profile: UserProfile & {
    districts?: { id: string; name: string; domain: string | null };
    schools?: { id: string; name: string };
  };
}

export default function CreateClassForm({ profile }: CreateClassFormProps) {
  const router = useRouter();
  const supabase = createClient();

  // Form state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [period, setPeriod] = useState<string>("");
  const [newSubjectName, setNewSubjectName] = useState<string>("");
  const [newClassName, setNewClassName] = useState<string>("");

  // Data state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<ClassItem[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showAddClass, setShowAddClass] = useState(false);

  useEffect(() => {
    fetchSubjects();
    fetchClasses();
  }, []);

  useEffect(() => {
    // Filter classes based on selected subject
    if (selectedSubjectId) {
      setFilteredClasses(
        classes.filter((cls) => cls.subject_id === selectedSubjectId)
      );
    } else {
      setFilteredClasses([]);
    }
    setSelectedClassId("");
  }, [selectedSubjectId, classes]);

  const fetchSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .eq("school_id", profile.school_id)
        .order("name");

      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      console.error("Error fetching subjects:", error);
    }
  };

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("school_id", profile.school_id)
        .order("name");

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  };

  const handleAddSubject = async () => {
    if (!newSubjectName.trim()) {
      setError("Subject name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase
        .from("subjects")
        .insert({
          name: newSubjectName.trim(),
          school_id: profile.school_id,
        })
        .select()
        .single();

      if (error) throw error;

      setSubjects([...subjects, data]);
      setSelectedSubjectId(data.id);
      setNewSubjectName("");
      setShowAddSubject(false);
      setSuccess("Subject added successfully!");
    } catch (error: any) {
      setError(`Failed to add subject: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClass = async () => {
    if (!newClassName.trim()) {
      setError("Class name is required");
      return;
    }

    if (!selectedSubjectId) {
      setError("Please select a subject first");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase
        .from("classes")
        .insert({
          name: newClassName.trim(),
          subject_id: selectedSubjectId,
          school_id: profile.school_id,
        })
        .select()
        .single();

      if (error) throw error;

      const updatedClasses = [...classes, data];
      setClasses(updatedClasses);
      setFilteredClasses(
        updatedClasses.filter((cls) => cls.subject_id === selectedSubjectId)
      );
      setSelectedClassId(data.id);
      setNewClassName("");
      setShowAddClass(false);
      setSuccess("Class added successfully!");
    } catch (error: any) {
      setError(`Failed to add class: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedSubjectId) {
      setError("Please select a subject");
      return;
    }

    if (!selectedClassId) {
      setError("Please select a class");
      return;
    }

    if (!period.trim()) {
      setError("Please enter a period");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/dashboard/classes/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subjectId: selectedSubjectId,
          classId: selectedClassId,
          period: period.trim(),
          schoolId: profile.school_id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create class period");
      }

      setSuccess("Class period created successfully!");
      setTimeout(() => {
        router.push("/dashboard/classes");
      }, 2000);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back Button */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </Link>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-start gap-3">
              <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-green-800">Success</h3>
                <p className="text-sm text-green-700 mt-1">{success}</p>
              </div>
            </div>
          )}

          {/* Subject Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject
            </label>
            <div className="space-y-3">
              <div className="relative">
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 appearance-none text-gray-900"
                  disabled={loading}
                >
                  <option value="">Select a subject...</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-2.5 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>

              {!showAddSubject ? (
                <button
                  type="button"
                  onClick={() => setShowAddSubject(true)}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add New Subject
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="Enter subject name..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={handleAddSubject}
                    disabled={loading || !newSubjectName.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddSubject(false);
                      setNewSubjectName("");
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Class Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Class
            </label>
            <div className="space-y-3">
              <div className="relative">
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 appearance-none text-gray-900"
                  disabled={loading || !selectedSubjectId}
                >
                  <option value="">
                    {selectedSubjectId
                      ? "Select a class..."
                      : "Select a subject first"}
                  </option>
                  {filteredClasses.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-2.5 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>

              {selectedSubjectId && !showAddClass ? (
                <button
                  type="button"
                  onClick={() => setShowAddClass(true)}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add New Class
                </button>
              ) : selectedSubjectId && showAddClass ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="Enter class name..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={handleAddClass}
                    disabled={loading || !newClassName.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddClass(false);
                      setNewClassName("");
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {/* Period Input */}
          <div>
            <label
              htmlFor="period"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Period
            </label>
            <input
              type="text"
              id="period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="e.g., 1, 2A, 3B, Morning, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              disabled={loading}
            />
            <p className="text-sm text-gray-500 mt-1">
              Enter the period identifier (can be numbers, letters, or text)
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
            <Link
              href="/dashboard"
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </>
              ) : (
                <>
                  <BookOpen className="w-4 h-4" />
                  Create Class Period
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
