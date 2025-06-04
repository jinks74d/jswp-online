// components/dashboard/users/EditUserForm.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Mail,
  AlertCircle,
  CheckCircle,
  Save,
  Key,
} from "lucide-react";
import Link from "next/link";
import { UserRole } from "@/lib/supabase";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  schoolId: string;
  newPassword: string;
}

interface School {
  id: string;
  name: string;
}

interface UserToEdit {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: UserRole;
  school_id: string | null;
  schools?: { id: string; name: string } | null;
}

interface EditUserFormProps {
  userToEdit: UserToEdit;
  schools: School[];
  currentUserRole: UserRole;
  districtName: string;
}

export default function EditUserForm({
  userToEdit,
  schools,
  currentUserRole,
  districtName,
}: EditUserFormProps) {
  const [formData, setFormData] = useState<FormData>({
    firstName: userToEdit.first_name || "",
    lastName: userToEdit.last_name || "",
    email: userToEdit.email,
    role: userToEdit.role,
    schoolId: userToEdit.school_id || "",
    newPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const generatePassword = () => {
    const length = 12;
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setFormData((prev) => ({ ...prev, newPassword: password }));
  };

  const validateForm = (): string | null => {
    if (!formData.email.trim()) return "Email is required";
    if (!formData.firstName.trim()) return "First name is required";
    if (!formData.lastName.trim()) return "Last name is required";

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return "Please enter a valid email address";
    }

    // School is required for school_admin and student
    if (
      (formData.role === "school_admin" || formData.role === "student") &&
      !formData.schoolId
    ) {
      return formData.role === "school_admin"
        ? "School selection is required for School Administrators"
        : "School selection is required for Students";
    }

    // Password validation if provided
    if (formData.newPassword && formData.newPassword.length < 6) {
      return "New password must be at least 6 characters";
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

      // Call API to update user
      const response = await fetch(
        `/api/dashboard/users/${userToEdit.id}/edit`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            email: formData.email.trim(),
            role: formData.role,
            schoolId: formData.schoolId || null,
            newPassword: formData.newPassword || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update user");
      }

      setSuccess(true);

      // Redirect after success
      setTimeout(() => {
        router.push("/dashboard/users");
      }, 2000);
    } catch (error: any) {
      console.error("Error updating user:", error);
      setError(error.message || "An error occurred while updating the user");
    } finally {
      setLoading(false);
    }
  };

  const getRoleDisplayName = (role: UserRole): string => {
    switch (role) {
      case "district_admin":
        return "District Administrator";
      case "school_admin":
        return "School Administrator";
      case "teacher":
        return "Teacher";
      case "student":
        return "Student";
      default:
        return role;
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
            User Updated Successfully!
          </h2>
          <p className="text-gray-600 mb-6">
            {formData.firstName} {formData.lastName}'s profile has been updated.
          </p>
          {formData.newPassword && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-blue-900 mb-2">
                New Password Set
              </h3>
              <p className="text-sm text-blue-700">
                The user's password has been updated. Make sure to share the new
                credentials securely.
              </p>
            </div>
          )}
          <p className="text-sm text-gray-500">Redirecting to users list...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/users"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Edit User</h1>
        <p className="text-gray-600 mt-1">
          Update user information for {userToEdit.first_name}{" "}
          {userToEdit.last_name}
        </p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">
                Update Failed
              </h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Information
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    First Name *
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="John"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Last Name *
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
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
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="john.doe@school.edu"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="role"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Role *
                </label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  disabled={
                    loading ||
                    (currentUserRole === "school_admin" &&
                      userToEdit.role === "district_admin")
                  }
                >
                  {currentUserRole === "district_admin" && (
                    <option value="district_admin">
                      District Administrator
                    </option>
                  )}
                  <option value="school_admin">School Administrator</option>
                  <option value="teacher">Teacher</option>
                  <option value="student">Student</option>
                </select>
                {currentUserRole === "school_admin" &&
                  userToEdit.role === "district_admin" && (
                    <p className="text-sm text-gray-500 mt-1">
                      School administrators cannot change district administrator
                      roles
                    </p>
                  )}
              </div>

              {/* School Selection - Required for school_admin and student, optional for teacher */}
              {(formData.role === "school_admin" ||
                formData.role === "teacher" ||
                formData.role === "student") &&
                schools.length > 0 && (
                  <div>
                    <label
                      htmlFor="schoolId"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      School{" "}
                      {formData.role === "school_admin" ||
                      formData.role === "student"
                        ? "*"
                        : "(Optional)"}
                    </label>
                    <select
                      id="schoolId"
                      name="schoolId"
                      value={formData.schoolId}
                      onChange={handleInputChange}
                      required={
                        formData.role === "school_admin" ||
                        formData.role === "student"
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      disabled={loading}
                    >
                      <option value="">
                        {formData.role === "school_admin" ||
                        formData.role === "student"
                          ? "Select a school"
                          : "No school assignment"}
                      </option>
                      {schools.map((school) => (
                        <option key={school.id} value={school.id}>
                          {school.name}
                        </option>
                      ))}
                    </select>
                    {formData.role === "student" && (
                      <p className="text-sm text-gray-500 mt-1">
                        Students must be enrolled in a school
                      </p>
                    )}
                  </div>
                )}
            </div>
          </div>

          {/* Password Reset Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Key className="w-5 h-5" />
                Password Reset
              </h2>
              <button
                type="button"
                onClick={() => setShowPasswordReset(!showPasswordReset)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                {showPasswordReset ? "Cancel Password Reset" : "Reset Password"}
              </button>
            </div>

            {showPasswordReset && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 mb-4">
                  Setting a new password will immediately update the user's
                  login credentials.
                </p>
                <div>
                  <label
                    htmlFor="newPassword"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    New Password
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      id="newPassword"
                      name="newPassword"
                      value={formData.newPassword}
                      onChange={handleInputChange}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-mono"
                      placeholder="Enter new password"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={generatePassword}
                      disabled={loading}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      Generate
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to keep current password unchanged
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
            <Link
              href="/dashboard/users"
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
                  Updating User...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Update User
                </>
              )}
            </button>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            User Update Process:
          </h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• User profile information will be updated immediately</li>
            <li>• Password changes take effect immediately if provided</li>
            <li>
              • User may need to log in again if email or password changed
            </li>
            <li>
              • School assignment changes are reflected in permissions
              immediately
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
