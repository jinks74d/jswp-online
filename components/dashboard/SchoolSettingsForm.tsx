// components/dashboard/SchoolSettingsForm.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { 
  Save, 
  GraduationCap, 
  MapPin, 
  Palette, 
  Upload,
  AlertCircle,
  CheckCircle,
  X
} from "lucide-react";
import { UserProfile } from "@/lib/supabase";

interface School {
  id: string;
  name: string;
  address: string | null;
  district_id: string;
  primary_color?: string | null;
  secondary_color?: string | null;
  logo_url?: string | null;
  settings: any;
  created_at: string | null;
  updated_at: string | null;
}

interface District {
  id: string;
  name: string;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
}

interface SchoolSettingsFormProps {
  school: School;
  district: District;
  userProfile: UserProfile;
}

export default function SchoolSettingsForm({ 
  school, 
  district,
  userProfile 
}: SchoolSettingsFormProps) {
  const [formData, setFormData] = useState({
    name: school.name,
    address: school.address || "",
    primary_color: school.primary_color || district.primary_color || "#3B82F6",
    secondary_color: school.secondary_color || district.secondary_color || "#64748B",
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const supabase = createClient();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleColorChange = (colorType: "primary_color" | "secondary_color", color: string) => {
    setFormData(prev => ({
      ...prev,
      [colorType]: color
    }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      setMessage({
        type: "error",
        text: "Please upload a valid image file (JPEG, PNG, GIF, WebP, or SVG)"
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({
        type: "error",
        text: "File size must be less than 5MB"
      });
      return;
    }

    setLogoUploading(true);
    setMessage(null);

    try {
      // Create form data for the API request
      const formData = new FormData();
      formData.append('logo', file);
      
      // Use the API route for school logo upload
      const response = await fetch(`/api/schools/${school.id}/upload-logo`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload logo');
      }

      setMessage({
        type: "success",
        text: "Logo uploaded successfully! It may take a moment to appear."
      });

      // Refresh the page to show new logo
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error: any) {
      console.error('Logo upload error:', error);
      setMessage({
        type: "error",
        text: error.message || "Failed to upload logo"
      });
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Validate required fields
      if (!formData.name.trim()) {
        throw new Error("School name is required");
      }

      // Update school information via API
      console.log('Sending update request for school:', school.id, {
        name: formData.name.trim(),
        address: formData.address.trim() || null,
        primary_color: formData.primary_color,
        secondary_color: formData.secondary_color,
      });

      const response = await fetch(`/api/schools/${school.id}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          address: formData.address.trim() || null,
          primary_color: formData.primary_color,
          secondary_color: formData.secondary_color,
        }),
      });

      const result = await response.json();
      console.log('API Response:', response.status, result);

      if (!response.ok) {
        console.error('API Error:', result);
        throw new Error(result.error || 'Failed to update school settings');
      }

      setMessage({
        type: "success",
        text: "School settings updated successfully!"
      });

      // Refresh the page to reflect changes in the UI
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error: any) {
      console.error('Update error:', error);
      setMessage({
        type: "error",
        text: error.message || "Failed to update school settings"
      });
    } finally {
      setLoading(false);
    }
  };

  const dismissMessage = () => {
    setMessage(null);
  };

  // Check if colors are using district defaults
  const isUsingDistrictColors = 
    formData.primary_color === district.primary_color && 
    formData.secondary_color === district.secondary_color;

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-8">
        {message && (
          <div className={`mb-6 rounded-md p-4 ${
            message.type === "success" 
              ? "bg-green-50 border border-green-200" 
              : "bg-red-50 border border-red-200"
          }`}>
            <div className="flex justify-between items-start">
              <div className="flex">
                {message.type === "success" ? (
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0" />
                )}
                <p className={`text-sm ${
                  message.type === "success" ? "text-green-800" : "text-red-800"
                }`}>
                  {message.text}
                </p>
              </div>
              <button
                onClick={dismissMessage}
                className={`${
                  message.type === "success" ? "text-green-400 hover:text-green-600" : "text-red-400 hover:text-red-600"
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* School Information */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              School Information
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
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
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full pl-10 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="123 School Street, City, State"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* School Logo */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              School Logo
            </h2>
            
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                <div className="w-40 h-40 border-2 border-gray-200 rounded-lg flex items-center justify-center bg-gray-50">
                  {school.logo_url ? (
                    <img 
                      src={school.logo_url}
                      alt={`${school.name} logo`}
                      className="w-full h-full object-contain rounded-lg"
                    />
                  ) : district.logo_url ? (
                    <div className="text-center">
                      <img 
                        src={district.logo_url}
                        alt={`${district.name} logo (district default)`}
                        className="w-full h-full object-contain rounded-lg opacity-60"
                      />
                      <p className="text-xs text-gray-500 mt-1">District logo</p>
                    </div>
                  ) : (
                    <GraduationCap className="w-8 h-8 text-gray-400" />
                  )}
                </div>
              </div>
              
              <div className="flex-1">
                <div className="mb-4">
                  <input
                    type="file"
                    id="logo"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={logoUploading}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                  />
                </div>
                <p className="text-sm text-gray-600">
                  Upload a school logo. Supported formats: JPEG, PNG, GIF, WebP, SVG. Max size: 5MB.
                  {!school.logo_url && district.logo_url && (
                    <span className="block mt-1 text-blue-600">
                      Currently using district logo as default.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* School Colors */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5" />
              School Colors
            </h2>
            
            {isUsingDistrictColors && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  Currently using district colors. Customize below to set school-specific colors.
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="primary_color" className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="primary_color"
                    value={formData.primary_color}
                    onChange={(e) => handleColorChange("primary_color", e.target.value)}
                    disabled={loading}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer disabled:opacity-50"
                  />
                  <input
                    type="text"
                    value={formData.primary_color}
                    onChange={(e) => handleColorChange("primary_color", e.target.value)}
                    disabled={loading}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-mono"
                    placeholder="#3B82F6"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="secondary_color" className="block text-sm font-medium text-gray-700 mb-2">
                  Secondary Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="secondary_color"
                    value={formData.secondary_color}
                    onChange={(e) => handleColorChange("secondary_color", e.target.value)}
                    disabled={loading}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer disabled:opacity-50"
                  />
                  <input
                    type="text"
                    value={formData.secondary_color}
                    onChange={(e) => handleColorChange("secondary_color", e.target.value)}
                    disabled={loading}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-mono"
                    placeholder="#64748B"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}