// app/dashboard/users/invite/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Mail,
  AlertCircle,
  CheckCircle,
  UserPlus,
  Key,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/app/dashboard/auth-provider";

interface FormData {
  email: string;
  firstName: string;
  lastName: string;
  role: "district_admin" | "school_admin" | "teacher" | "student";
  schoolId: string;
  password: string;
}

interface School {
  id: string;
  name: string;
}

export default function CreateUserPage() {
  const [formData, setFormData] = useState<FormData>({
    email: "",
    firstName: "",
    lastName: "",
    role: "teacher",
    schoolId: "",
    password: "",
  });
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [createdUser, setCreatedUser] = useState<any>(null);

  const router = useRouter();
  const supabase = createClient();
  const { profile } = useAuth();

  useEffect(() => {
    fetchSchools();
    generatePassword(); // Generate initial password
  }, []);

  const fetchSchools = async () => {
    try {
      console.log("Fetching schools...");

      // Get current user and their district
      const {
        data: { user },
      } = await supabase.auth.getUser();
      console.log("Current user:", user?.id);

      if (!user) return;

      const { data: userProfile } = await supabase
        .from("user_profiles")
        .select("district_id")
        .eq("id", user.id)
        .single();

      console.log("User profile:", userProfile);

      if (!userProfile?.district_id) return;

      const { data, error } = await supabase
        .from("schools")
        .select("id, name")
        .eq("district_id", userProfile.district_id)
        .order("name");

      console.log("Schools query result:", { data, error });

      if (error) throw error;
      setSchools(data || []);
      console.log("Schools set:", data?.length || 0);
    } catch (error) {
      console.error("Error fetching schools:", error);
    } finally {
      setLoadingSchools(false);
    }
  };

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
    setFormData((prev) => ({ ...prev, password }));
  };

  const validateForm = (): string | null => {
    if (!formData.email.trim()) return "Email is required";
    if (!formData.firstName.trim()) return "First name is required";
    if (!formData.lastName.trim()) return "Last name is required";
    if (!formData.password || formData.password.length < 6)
      return "Password must be at least 6 characters";

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

      // Verify user has permission
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You must be logged in to create users");
      }

      const { data: userProfile } = await supabase
        .from("user_profiles")
        .select("role, district_id")
        .eq("id", user.id)
        .single();

      if (
        !userProfile ||
        !["district_admin", "school_admin"].includes(userProfile.role) ||
        !userProfile.district_id
      ) {
        throw new Error("You do not have permission to create users");
      }

      // Call API to create user
      const response = await fetch("/api/dashboard/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email.trim(),
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          role: formData.role,
          schoolId: formData.schoolId || null,
          password: formData.password,
          districtId: userProfile.district_id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create user");
      }

      setCreatedUser(result.user);
      setSuccess(true);

      // Redirect after success
      setTimeout(() => {
        router.push("/dashboard/users");
      }, 5000);
    } catch (error: any) {
      console.error("Error creating user:", error);
      setError(error.message || "An error occurred while creating the user");
    } finally {
      setLoading(false);
    }
  };

  const getRoleDisplayName = (role: string): string => {
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
            User Created Successfully!
          </h2>
          <p className="text-gray-600 mb-6">
            {formData.firstName} {formData.lastName} has been added to your
            district as a {getRoleDisplayName(formData.role).toLowerCase()}.
          </p>

          {/* User Credentials */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6 text-left">
            <h3 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
              <Key className="w-5 h-5" />
              Login Credentials
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-blue-800">Email:</span>
                <span className="ml-2 text-blue-700 font-mono">
                  {formData.email}
                </span>
              </div>
              <div>
                <span className="font-medium text-blue-800">Password:</span>
                <span className="ml-2 text-blue-700 font-mono">
                  {formData.password}
                </span>
              </div>
              <div>
                <span className="font-medium text-blue-800">Role:</span>
                <span className="ml-2 text-blue-700">
                  {getRoleDisplayName(formData.role)}
                </span>
              </div>
              {formData.schoolId && (
                <div>
                  <span className="font-medium text-blue-800">School:</span>
                  <span className="ml-2 text-blue-700">
                    {schools.find((s) => s.id === formData.schoolId)?.name}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-2">Next Steps:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Share the login credentials with the new user</li>
              <li>• The user can login immediately using District User mode</li>
              <li>• They can change their password after first login</li>
              <li>
                •{" "}
                {formData.role === "teacher"
                  ? "They can start creating assignments"
                  : "They can access their dashboard"}
              </li>
            </ul>
          </div>

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
        <h1 className="text-3xl font-bold text-gray-900">Create New User</h1>
        <p className="text-gray-600 mt-1">
          Create administrators, teachers, and students
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
                  disabled={loading}
                >
                  {profile?.role === "district_admin" && (
                    <option value="district_admin">
                      District Administrator
                    </option>
                  )}
                  <option value="school_admin">School Administrator</option>
                  <option value="teacher">Teacher</option>
                  <option value="student">Student</option>
                </select>
              </div>

              {/* School Selection - Required for school_admin and student, optional for teacher */}
              {(formData.role === "school_admin" ||
                formData.role === "teacher" ||
                formData.role === "student") && (
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
                    disabled={loading || loadingSchools}
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
                  {loadingSchools && (
                    <p className="text-sm text-gray-500 mt-1">
                      Loading schools...
                    </p>
                  )}
                  {formData.role === "teacher" && (
                    <p className="text-sm text-gray-500 mt-1">
                      Teachers can be assigned to schools later if needed
                    </p>
                  )}
                  {formData.role === "student" && (
                    <p className="text-sm text-gray-500 mt-1">
                      Students must be assigned to a school
                    </p>
                  )}
                </div>
              )}

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Password *
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-mono"
                    placeholder="Enter password"
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
                  User can change this password after their first login
                </p>
              </div>
            </div>
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
              disabled={loading || loadingSchools}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating User...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create User
                </>
              )}
            </button>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            User Creation Process:
          </h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• User account will be created immediately</li>
            <li>• Login credentials will be displayed after creation</li>
            <li>• User can login right away using District User mode</li>
            <li>• Share the credentials securely with the new user</li>
            <li>• Students require school assignment for proper access</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
