// app/dashboard/schools/create/page.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  MapPin,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth/OptimizedAuthProvider";

interface FormData {
  name: string;
  address: string;
  description: string;
}

export default function CreateSchoolPage() {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    address: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const router = useRouter();
  const supabase = createClient();
  const { profile } = useAuth();

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return "School name is required";
    if (formData.name.length < 3)
      return "School name must be at least 3 characters";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Validate form
      const validationError = validateForm();
      if (validationError) {
        throw new Error(validationError);
      }

      // Verify user has district admin role
      if (
        !profile ||
        profile.role !== "district_admin" ||
        !profile.district_id
      ) {
        throw new Error("You do not have permission to create schools");
      }

      // Create the school
      const { data: school, error: schoolError } = await supabase
        .from("schools")
        .insert({
          name: formData.name.trim(),
          address: formData.address.trim() || null,
          district_id: profile.district_id,
          settings: {
            description: formData.description.trim() || null,
          },
        })
        .select()
        .single();

      if (schoolError) {
        throw new Error(`Failed to create school: ${schoolError.message}`);
      }

      setSuccess(true);

      // Redirect after success
      setTimeout(() => {
        router.push("/dashboard/schools");
      }, 2000);
    } catch (error: any) {
      console.error("Error creating school:", error);
      setError(error.message || "An error occurred while creating the school");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            School Created Successfully!
          </h2>
          <p className="text-gray-600 mb-6">
            "{formData.name}" has been added to your district.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-2">Next Steps:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Invite school administrators</li>
              <li>• Add teachers to the school</li>
              <li>• Set up classes and student enrollment</li>
            </ul>
          </div>
          <p className="text-sm text-gray-500">
            Redirecting to schools list...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/schools"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Schools
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Add New School</h1>
        <p className="text-gray-600 mt-1">
          Create a new school in your district
        </p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">
                Creation Failed
              </h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* School Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              School Information
            </h2>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  School Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Enter school name"
                  disabled={loading}
                />
              </div>

              <div>
                <label
                  htmlFor="address"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Address (Optional)
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="123 School Street, City, State 12345"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Description (Optional)
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Brief description of the school"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
            <Link
              href="/dashboard/schools"
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating School...
                </>
              ) : (
                <>
                  <Building2 className="w-4 h-4" />
                  Create School
                </>
              )}
            </button>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            After creating the school:
          </h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• You can invite school administrators</li>
            <li>• Teachers and students can be assigned to this school</li>
            <li>• School-specific settings and classes can be configured</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
