// app/super-admin/districts/create/page.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Mail,
  Globe,
  User,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";

interface FormData {
  name: string;
  domain: string;
  pocEmail: string;
  pocFirstName: string;
  pocLastName: string;
  pocPassword: string;
}

export default function CreateDistrictPage() {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    domain: "",
    pocEmail: "",
    pocFirstName: "",
    pocLastName: "",
    pocPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return "District name is required";
    if (!formData.pocEmail.trim()) return "POC email is required";
    if (!formData.pocFirstName.trim()) return "POC first name is required";
    if (!formData.pocLastName.trim()) return "POC last name is required";
    if (!formData.pocPassword || formData.pocPassword.length < 6) {
      return "POC password must be at least 6 characters";
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.pocEmail)) {
      return "Please enter a valid email address";
    }

    // Validate domain format if provided
    if (formData.domain && !formData.domain.includes(".")) {
      return "Please enter a valid domain (e.g., schooldistrict.edu)";
    }

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

      console.log("Submitting form:", formData);

      // Call our API route to create the district
      const response = await fetch("/api/super-admin/districts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          domain: formData.domain,
          pocEmail: formData.pocEmail,
          pocFirstName: formData.pocFirstName,
          pocLastName: formData.pocLastName,
          pocPassword: formData.pocPassword,
        }),
      });

      console.log("Response status:", response.status);

      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      console.log("Content type:", contentType);

      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        throw new Error("Server returned invalid response format");
      }

      const result = await response.json();
      console.log("Response data:", result);

      if (!response.ok) {
        throw new Error(result.error || "Failed to create district");
      }

      setSuccess(true);

      // Redirect after success
      setTimeout(() => {
        router.push("/super-admin/districts");
      }, 2000);
    } catch (error: any) {
      console.error("Error creating district:", error);
      setError(
        error.message || "An error occurred while creating the district"
      );
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
            District Created Successfully!
          </h2>
          <p className="text-gray-600 mb-6">
            The district "{formData.name}" has been created and the POC has been
            notified.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-2">Next Steps:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• POC can now log in with their credentials</li>
              <li>• POC can create schools within their district</li>
              <li>• POC can invite teachers and other administrators</li>
            </ul>
          </div>
          <p className="text-sm text-gray-500">
            Redirecting to districts list...
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
          href="/super-admin/districts"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Districts
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">
          Create New District
        </h1>
        <p className="text-gray-600 mt-1">
          Add a new district and set up the point of contact
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
          {/* District Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              District Information
            </h2>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  District Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Enter district name"
                  disabled={loading}
                />
              </div>

              <div>
                <label
                  htmlFor="domain"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Email Domain (Optional)
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    id="domain"
                    name="domain"
                    value={formData.domain}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="schooldistrict.edu"
                    disabled={loading}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  If specified, only users with this email domain can join this
                  district
                </p>
              </div>
            </div>
          </div>

          {/* POC Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Point of Contact (District Admin)
            </h2>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="pocEmail"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    id="pocEmail"
                    name="pocEmail"
                    value={formData.pocEmail}
                    onChange={handleInputChange}
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="admin@schooldistrict.edu"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="pocFirstName"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    First Name *
                  </label>
                  <input
                    type="text"
                    id="pocFirstName"
                    name="pocFirstName"
                    value={formData.pocFirstName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="John"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label
                    htmlFor="pocLastName"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Last Name *
                  </label>
                  <input
                    type="text"
                    id="pocLastName"
                    name="pocLastName"
                    value={formData.pocLastName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="Doe"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="pocPassword"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Temporary Password *
                </label>
                <input
                  type="password"
                  id="pocPassword"
                  name="pocPassword"
                  value={formData.pocPassword}
                  onChange={handleInputChange}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Minimum 6 characters"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  The POC can change this password after their first login
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
            <Link
              href="/super-admin/districts"
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
                  Creating District...
                </>
              ) : (
                <>
                  <Building2 className="w-4 h-4" />
                  Create District
                </>
              )}
            </button>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            What happens next?
          </h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• The district will be created in the system</li>
            <li>• A District Admin account will be created for the POC</li>
            <li>• The POC can log in immediately with their credentials</li>
            <li>
              • The POC can then create schools and invite users to their
              district
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
