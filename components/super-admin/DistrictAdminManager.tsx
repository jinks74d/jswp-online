// components/super-admin/DistrictAdminManager.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import {
  Users,
  Plus,
  Mail,
  User,
  Trash2,
  AlertCircle,
  CheckCircle,
  Crown,
  Shield,
  X,
} from "lucide-react";

interface DistrictAdmin {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  created_at: string;
  metadata: any;
  is_poc: boolean;
}

interface DistrictAdminManagerProps {
  districtId: string;
  districtName: string;
}

interface NewAdminForm {
  email: string;
  firstName: string;
  lastName: string;
  isPoc: boolean;
}

export default function DistrictAdminManager({
  districtId,
  districtName,
}: DistrictAdminManagerProps) {
  const [admins, setAdmins] = useState<DistrictAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<NewAdminForm>({
    email: "",
    firstName: "",
    lastName: "",
    isPoc: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchDistrictAdmins();
  }, [districtId]);

  const fetchDistrictAdmins = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name, email, created_at, metadata")
        .eq("district_id", districtId)
        .eq("role", "district_admin")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching district admins:", error);
        setError("Failed to load district administrators");
        return;
      }

      // Transform data to include is_poc flag
      const transformedAdmins = (data || []).map((admin: any) => ({
        ...admin,
        is_poc: admin.metadata?.is_poc === true,
      }));

      setAdmins(transformedAdmins);
    } catch (error) {
      console.error("Error fetching district admins:", error);
      setError("Failed to load district administrators");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.email.trim()) return "Email is required";
    if (!formData.firstName.trim()) return "First name is required";
    if (!formData.lastName.trim()) return "Last name is required";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return "Please enter a valid email address";
    }

    // Check if email already exists in this district
    const existingAdmin = admins.find(
      (admin) => admin.email.toLowerCase() === formData.email.toLowerCase()
    );
    if (existingAdmin) {
      return "This email is already a district administrator";
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const validationError = validateForm();
      if (validationError) {
        throw new Error(validationError);
      }

      // Call API to create district admin
      const response = await fetch("/api/super-admin/districts/add-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          districtId,
          email: formData.email.trim(),
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          isPoc: formData.isPoc,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to add district administrator");
      }

      setSuccess(
        `Successfully added ${formData.firstName} ${formData.lastName} as district administrator`
      );

      // Reset form
      setFormData({
        email: "",
        firstName: "",
        lastName: "",
        isPoc: false,
      });
      setShowAddForm(false);

      // Refresh the list
      await fetchDistrictAdmins();
    } catch (error: any) {
      console.error("Error adding district admin:", error);
      setError(error.message || "Failed to add district administrator");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (adminId: string, adminName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove ${adminName} as a district administrator? This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(adminId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/super-admin/districts/remove-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          districtId,
          adminId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to remove district administrator"
        );
      }

      setSuccess(`Successfully removed ${adminName} as district administrator`);

      // Refresh the list
      await fetchDistrictAdmins();
    } catch (error: any) {
      console.error("Error removing district admin:", error);
      setError(error.message || "Failed to remove district administrator");
    } finally {
      setDeletingId(null);
    }
  };

  const togglePoc = async (
    adminId: string,
    currentIsPoc: boolean,
    adminName: string
  ) => {
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/super-admin/districts/toggle-poc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          districtId,
          adminId,
          isPoc: !currentIsPoc,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update POC status");
      }

      setSuccess(
        `Successfully ${!currentIsPoc ? "set" : "removed"} ${adminName} as POC`
      );

      // Refresh the list
      await fetchDistrictAdmins();
    } catch (error: any) {
      console.error("Error toggling POC status:", error);
      setError(error.message || "Failed to update POC status");
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5" />
          District Administrators
          <span className="text-sm font-normal text-gray-500">
            ({admins.length})
          </span>
        </h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Administrator
        </button>
      </div>

      {/* Success/Error Messages */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-green-800">Success</h3>
            <p className="text-sm text-green-700 mt-1">{success}</p>
          </div>
        </div>
      )}

      {/* Add Administrator Form */}
      {showAddForm && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Add New District Administrator
            </h3>
            <button
              onClick={() => {
                setShowAddForm(false);
                setFormData({
                  email: "",
                  firstName: "",
                  lastName: "",
                  isPoc: false,
                });
                setError("");
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  First Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter first name"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Last Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter last name"
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
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
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter email address"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPoc"
                name="isPoc"
                checked={formData.isPoc}
                onChange={handleInputChange}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                disabled={submitting}
              />
              <label htmlFor="isPoc" className="text-sm text-gray-700">
                Set as Point of Contact (POC) for this district
              </label>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add Administrator
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({
                    email: "",
                    firstName: "",
                    lastName: "",
                    isPoc: false,
                  });
                  setError("");
                }}
                className="px-4 py-2 text-gray-600 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Administrators List */}
      <div className="space-y-3">
        {admins.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No District Administrators
            </h3>
            <p className="text-gray-600 mb-4">
              Add district administrators to manage {districtName}
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add First Administrator
            </button>
          </div>
        ) : (
          admins.map((admin) => (
            <div
              key={admin.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    {admin.is_poc ? (
                      <Crown className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Shield className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">
                        {admin.first_name} {admin.last_name}
                      </h4>
                      {admin.is_poc && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          POC
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{admin.email}</p>
                    <p className="text-xs text-gray-500">
                      Added {new Date(admin.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      togglePoc(
                        admin.id,
                        admin.is_poc,
                        `${admin.first_name} ${admin.last_name}`
                      )
                    }
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      admin.is_poc
                        ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    title={admin.is_poc ? "Remove POC status" : "Set as POC"}
                  >
                    {admin.is_poc ? "Remove POC" : "Set as POC"}
                  </button>
                  <button
                    onClick={() =>
                      handleDelete(
                        admin.id,
                        `${admin.first_name} ${admin.last_name}`
                      )
                    }
                    disabled={deletingId === admin.id}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                    title="Remove administrator"
                  >
                    {deletingId === admin.id ? (
                      <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> District administrators can manage schools,
          users, and settings within {districtName}. The Point of Contact (POC)
          receives important notifications and serves as the primary contact for
          the district.
        </p>
      </div>
    </div>
  );
}
