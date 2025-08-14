// components/dashboard/DistrictSettingsForm.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { 
  Save, 
  Building2, 
  Mail, 
  Globe, 
  Palette, 
  Upload,
  AlertCircle,
  CheckCircle,
  X
} from "lucide-react";
import { UserProfile } from "@/lib/supabase";
import DistrictLogo from "@/components/ui/DistrictLogo";

interface District {
  id: string;
  name: string;
  domain: string | null;
  poc_email: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  settings: any;
  created_at: string | null;
  updated_at: string | null;
}

interface DistrictSettingsFormProps {
  district: District;
  userProfile: UserProfile;
}

export default function DistrictSettingsForm({ 
  district, 
  userProfile 
}: DistrictSettingsFormProps) {
  const [formData, setFormData] = useState({
    name: district.name,
    domain: district.domain || "",
    poc_email: district.poc_email,
    primary_color: district.primary_color || "#3B82F6",
    secondary_color: district.secondary_color || "#64748B",
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
      
      // Use the API route instead of direct storage access
      const response = await fetch(`/api/districts/${district.id}/upload-logo`, {
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
      if (!formData.name.trim() || !formData.poc_email.trim()) {
        throw new Error("District name and contact email are required");
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.poc_email)) {
        throw new Error("Please enter a valid email address");
      }

      // Validate domain format (if provided)
      if (formData.domain.trim()) {
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
        if (!domainRegex.test(formData.domain.trim())) {
          throw new Error("Please enter a valid domain name");
        }
      }

      // Update district information via API
      console.log('Sending update request for district:', district.id, {
        name: formData.name.trim(),
        domain: formData.domain.trim() || null,
        poc_email: formData.poc_email.trim(),
        primary_color: formData.primary_color,
        secondary_color: formData.secondary_color,
      });

      const response = await fetch(`/api/districts/${district.id}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          domain: formData.domain.trim() || null,
          poc_email: formData.poc_email.trim(),
          primary_color: formData.primary_color,
          secondary_color: formData.secondary_color,
        }),
      });

      const result = await response.json();
      console.log('API Response:', response.status, result);

      if (!response.ok) {
        console.error('API Error:', result);
        throw new Error(result.error || 'Failed to update district settings');
      }

      setMessage({
        type: "success",
        text: "District settings updated successfully!"
      });

      // Refresh the page to reflect changes in the UI
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error: any) {
      console.error('Update error:', error);
      setMessage({
        type: "error",
        text: error.message || "Failed to update district settings"
      });
    } finally {
      setLoading(false);
    }
  };

  const dismissMessage = () => {
    setMessage(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Alert Messages */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg border flex items-start gap-3 ${
          message.type === "success" 
            ? "bg-green-50 border-green-200 text-green-800" 
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          <div className="flex-shrink-0">
            {message.type === "success" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{message.text}</p>
          </div>
          <button
            onClick={dismissMessage}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information Section */}
        <div className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Building2 className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Basic Information
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                District Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter district name"
              />
            </div>

            <div>
              <label htmlFor="poc_email" className="block text-sm font-medium text-gray-700 mb-2">
                Contact Email *
              </label>
              <div className="relative">
                <input
                  type="email"
                  id="poc_email"
                  name="poc_email"
                  value={formData.poc_email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="contact@district.edu"
                />
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              </div>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-2">
                District Domain
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="domain"
                  name="domain"
                  value={formData.domain}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="district.edu (optional)"
                />
                <Globe className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Optional: Used for branding and email domain validation
              </p>
            </div>
          </div>
        </div>

        {/* Logo Section */}
        <div className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Upload className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              District Logo
            </h2>
          </div>

          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              <div className="w-40 h-40 border-2 border-gray-200 rounded-lg flex items-center justify-center bg-gray-50">
                {district.logo_url ? (
                  <DistrictLogo 
                    districtId={district.id}
                    districtName={district.name}
                    size={160}
                    className="rounded-lg"
                  />
                ) : (
                  <Building2 className="w-8 h-8 text-gray-400" />
                )}
              </div>
            </div>

            <div className="flex-1">
              <input
                type="file"
                id="logo-upload"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <label
                htmlFor="logo-upload"
                className={`inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer ${
                  logoUploading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Upload className="w-4 h-4" />
                {logoUploading ? 'Uploading...' : 'Upload New Logo'}
              </label>
              <p className="text-sm text-gray-500 mt-2">
                Recommended: Square image, max 5MB. Supported formats: JPEG, PNG, GIF, WebP
              </p>
            </div>
          </div>
        </div>

        {/* Branding Colors Section */}
        <div className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Palette className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              District Branding Colors
            </h2>
          </div>

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
                  className="w-12 h-10 border border-gray-300 rounded-md cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.primary_color}
                  onChange={(e) => handleColorChange("primary_color", e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="#3B82F6"
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Used for primary buttons and accents
              </p>
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
                  className="w-12 h-10 border border-gray-300 rounded-md cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.secondary_color}
                  onChange={(e) => handleColorChange("secondary_color", e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="#64748B"
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Used for borders and secondary elements
              </p>
            </div>
          </div>

          {/* Color Preview */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Color Preview</h4>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div 
                  className="w-6 h-6 rounded border border-gray-200"
                  style={{ backgroundColor: formData.primary_color }}
                ></div>
                <span className="text-sm text-gray-600">Primary</span>
              </div>
              <div className="flex items-center gap-2">
                <div 
                  className="w-6 h-6 rounded border border-gray-200"
                  style={{ backgroundColor: formData.secondary_color }}
                ></div>
                <span className="text-sm text-gray-600">Secondary</span>
              </div>
              <div className="flex-1 h-8 rounded border-2 flex items-center justify-center text-white text-sm font-medium"
                   style={{ 
                     backgroundColor: formData.primary_color,
                     borderColor: formData.secondary_color 
                   }}>
                Sample Button
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || logoUploading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
