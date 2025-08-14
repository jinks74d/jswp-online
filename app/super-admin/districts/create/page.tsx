// app/super-admin/districts/create/page.tsx
"use client";

import { useState, useRef, useCallback } from "react";
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
  Upload,
  Image as ImageIcon,
  Palette,
  X,
} from "lucide-react";
import Link from "next/link";
import { HexColorPicker } from "react-colorful";

interface FormData {
  name: string;
  domain: string;
  pocEmail: string;
  pocFirstName: string;
  pocLastName: string;
  pocPassword: string;
  logoFile: File | null;
  logoPreview: string | null;
  primaryColor: string;
  secondaryColor: string;
}

const PRESET_COLORS = [
  "#0B2559", // Dark Blue
  "#1e40af", // Blue
  "#059669", // Green
  "#dc2626", // Red
  "#7c3aed", // Purple
  "#ea580c", // Orange
  "#0891b2", // Cyan
  "#65a30d", // Lime
  "#be123c", // Rose
  "#4338ca", // Indigo
];

// Color conversion utilities
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

const rgbToHex = (r: number, g: number, b: number) => {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

const hslToRgb = (h: number, s: number, l: number) => {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  
  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }
  
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);
  
  return { r, g, b };
};

const parseColorInput = (input: string): string | null => {
  // Remove whitespace
  input = input.trim();
  
  // Hex format
  if (input.match(/^#?[0-9A-Fa-f]{6}$/)) {
    return input.startsWith('#') ? input : `#${input}`;
  }
  
  // RGB format: rgb(255, 255, 255) or 255, 255, 255
  const rgbMatch = input.match(/rgb\(?\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)?/i);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]);
    const g = parseInt(rgbMatch[2]);
    const b = parseInt(rgbMatch[3]);
    if (r <= 255 && g <= 255 && b <= 255) {
      return rgbToHex(r, g, b);
    }
  }
  
  // HSL format: hsl(360, 100%, 50%) or 360, 100%, 50%
  const hslMatch = input.match(/hsl\(?\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*\)?/i);
  if (hslMatch) {
    const h = parseInt(hslMatch[1]);
    const s = parseInt(hslMatch[2]);
    const l = parseInt(hslMatch[3]);
    if (h <= 360 && s <= 100 && l <= 100) {
      const rgb = hslToRgb(h, s, l);
      return rgbToHex(rgb.r, rgb.g, rgb.b);
    }
  }
  
  return null;
};

export default function CreateDistrictPage() {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    domain: "",
    pocEmail: "",
    pocFirstName: "",
    pocLastName: "",
    pocPassword: "",
    logoFile: null,
    logoPreview: null,
    primaryColor: "#0B2559",
    secondaryColor: "#1e40af",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPrimaryColorPicker, setShowPrimaryColorPicker] = useState(false);
  const [showSecondaryColorPicker, setShowSecondaryColorPicker] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [domainCheckStatus, setDomainCheckStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [domainCheckTimeout, setDomainCheckTimeout] = useState<NodeJS.Timeout | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Check domain availability when domain changes (with debounce)
    if (name === 'domain') {
      // Clear existing timeout
      if (domainCheckTimeout) {
        clearTimeout(domainCheckTimeout);
      }

      // Set new timeout for 500ms delay
      const timeout = setTimeout(() => {
        checkDomainAvailability(value);
      }, 500);

      setDomainCheckTimeout(timeout);
    }
  };

  const checkDomainAvailability = async (domain: string) => {
    // Reset status if domain is empty
    if (!domain.trim()) {
      setDomainCheckStatus('idle');
      return;
    }

    // Only check if domain looks valid
    if (!domain.includes('.')) {
      setDomainCheckStatus('idle');
      return;
    }

    setDomainCheckStatus('checking');

    try {
      const response = await fetch('/api/super-admin/districts/check-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim() })
      });

      const result = await response.json();
      
      if (response.ok) {
        setDomainCheckStatus(result.available ? 'available' : 'taken');
      } else {
        setDomainCheckStatus('idle');
      }
    } catch (error) {
      console.error('Error checking domain:', error);
      setDomainCheckStatus('idle');
    }
  };

  const handleLogoUpload = async (file: File) => {
    // Validate file
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setError("Logo file must be less than 5MB");
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError("Please upload an image file");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setFormData(prev => ({
        ...prev,
        logoFile: file,
        logoPreview: e.target?.result as string,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleLogoUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleLogoUpload(file);
    }
  };

  const removeLogo = () => {
    setFormData(prev => ({
      ...prev,
      logoFile: null,
      logoPreview: null,
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleColorSelect = (color: string, type: 'primary' | 'secondary') => {
    setFormData(prev => ({
      ...prev,
      [type === 'primary' ? 'primaryColor' : 'secondaryColor']: color,
    }));
  };

  const handleColorInputChange = (input: string, type: 'primary' | 'secondary') => {
    const parsedColor = parseColorInput(input);
    if (parsedColor) {
      handleColorSelect(parsedColor, type);
    } else {
      // Update the field even if invalid for real-time feedback
      setFormData(prev => ({
        ...prev,
        [type === 'primary' ? 'primaryColor' : 'secondaryColor']: input,
      }));
    }
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

    // Check if domain is taken
    if (domainCheckStatus === 'taken') {
      return "This domain is already in use by another district";
    }

    // Validate colors
    const validPrimaryColor = parseColorInput(formData.primaryColor);
    const validSecondaryColor = parseColorInput(formData.secondaryColor);
    
    if (!validPrimaryColor) {
      return "Please enter a valid primary color (hex, RGB, or HSL format)";
    }
    if (!validSecondaryColor) {
      return "Please enter a valid secondary color (hex, RGB, or HSL format)";
    }

    return null;
  };

  const uploadLogoToStorage = async (file: File, districtId: string): Promise<string | null> => {
    try {
      setUploadingLogo(true);
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `district-${districtId}/logo.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('district-logos')
        .upload(fileName, file, {
          upsert: true,
          cacheControl: '3600',
        });

      if (error) {
        console.error('Storage upload error:', error);
        return null;
      }

      // Return the API route URL that will serve the logo
      return `/api/districts/${districtId}/logo`;
    } catch (error) {
      console.error('Error uploading logo:', error);
      return null;
    } finally {
      setUploadingLogo(false);
    }
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

      // Parse colors to ensure they're in hex format
      const validPrimaryColor = parseColorInput(formData.primaryColor);
      const validSecondaryColor = parseColorInput(formData.secondaryColor);

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
          primaryColor: validPrimaryColor,
          secondaryColor: validSecondaryColor,
        }),
      });

      const contentType = response.headers.get("content-type");
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

      // Upload logo if provided
      if (formData.logoFile && result.district?.id) {
        const logoUrl = await uploadLogoToStorage(formData.logoFile, result.district.id);
        
        if (logoUrl) {
          // Update district with logo URL
          const { error: updateError } = await supabase
            .from('districts')
            .update({ logo_url: logoUrl })
            .eq('id', result.district.id);

          if (updateError) {
            console.error('Error updating district with logo:', updateError);
            // Don't fail the whole process for logo upload issues
          }
        }
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
        <div className="bg-white rounded-lg shadow-sm border-2 border-[#0B2559] p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            District Created Successfully!
          </h2>
          <p className="text-gray-600 mb-6">
            The district "{formData.name}" has been created with custom branding and the POC has been
            notified.
          </p>
          
          {/* Brand Preview */}
          {(formData.logoPreview || formData.primaryColor !== "#0B2559") && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-gray-900 mb-3">District Branding</h3>
              <div className="flex items-center justify-center gap-4">
                {formData.logoPreview && (
                  <img 
                    src={formData.logoPreview} 
                    alt="District Logo"
                    className="w-12 h-12 object-contain rounded"
                  />
                )}
                <div className="text-sm text-gray-700">
                  <div>Primary: {formData.primaryColor}</div>
                  <div>Secondary: {formData.secondaryColor}</div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-2">Next Steps:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• POC can now log in with their credentials</li>
              <li>• POC can create schools within their district</li>
              <li>• POC can invite teachers and other administrators</li>
              <li>• District branding will appear throughout the system</li>
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
    <div className="max-w-4xl mx-auto">
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
          Add a new district with custom branding and set up the point of contact
        </p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm border-2 border-[#0B2559] p-8">
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

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* District Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              District Information
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                      className={`w-full pl-10 pr-10 py-2 border rounded-md shadow-sm focus:outline-none text-gray-900 ${
                        domainCheckStatus === 'taken' 
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                          : domainCheckStatus === 'available'
                          ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                          : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                      }`}
                      placeholder="schooldistrict.edu"
                      disabled={loading}
                    />
                    <div className="absolute right-3 top-2.5">
                      {domainCheckStatus === 'checking' && (
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      )}
                      {domainCheckStatus === 'available' && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                      {domainCheckStatus === 'taken' && (
                        <X className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                  </div>
                  <div className="mt-1">
                    {domainCheckStatus === 'taken' && (
                      <p className="text-xs text-red-600">
                        This domain is already in use by another district
                      </p>
                    )}
                    {domainCheckStatus === 'available' && (
                      <p className="text-xs text-green-600">
                        Domain is available
                      </p>
                    )}
                    {(domainCheckStatus === 'idle' || domainCheckStatus === 'checking') && (
                      <p className="text-xs text-gray-500">
                        If specified, only users with this email domain can join this district
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Logo Upload Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  District Logo (Optional)
                </label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    formData.logoPreview 
                      ? 'border-green-300 bg-green-50' 
                      : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={(e) => e.preventDefault()}
                >
                  {formData.logoPreview ? (
                    <div className="space-y-3">
                      <img 
                        src={formData.logoPreview} 
                        alt="Logo preview"
                        className="w-20 h-20 object-contain mx-auto rounded"
                      />
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-sm text-blue-600 hover:text-blue-700"
                          disabled={loading}
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={removeLogo}
                          className="text-sm text-red-600 hover:text-red-700"
                          disabled={loading}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        Drop logo here or click to browse
                      </p>
                      <p className="text-xs text-gray-500">
                        PNG, JPG up to 5MB • Recommended 200x200px
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-3 inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        disabled={loading}
                      >
                        <Upload className="w-4 h-4" />
                        Choose File
                      </button>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Brand Colors Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Brand Colors
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Primary Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Color
                </label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowPrimaryColorPicker(!showPrimaryColorPicker)}
                      className="w-12 h-12 rounded-lg border-2 border-gray-300 shadow-sm"
                      style={{ backgroundColor: formData.primaryColor }}
                      disabled={loading}
                    />
                    <input
                      type="text"
                      value={formData.primaryColor}
                      onChange={(e) => handleColorInputChange(e.target.value, 'primary')}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                      placeholder="hex, rgb(r,g,b), hsl(h,s%,l%)"
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    Formats: #FF0000, rgb(255,0,0), hsl(0,100%,50%)
                  </div>
                  
                  {showPrimaryColorPicker && (
                    <div className="relative">
                      <div className="absolute top-2 right-2 z-10">
                        <button
                          type="button"
                          onClick={() => setShowPrimaryColorPicker(false)}
                          className="p-1 bg-white rounded-full shadow-md hover:bg-gray-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <HexColorPicker
                        color={formData.primaryColor}
                        onChange={(color) => handleColorSelect(color, 'primary')}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Secondary Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secondary Color
                </label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowSecondaryColorPicker(!showSecondaryColorPicker)}
                      className="w-12 h-12 rounded-lg border-2 border-gray-300 shadow-sm"
                      style={{ backgroundColor: formData.secondaryColor }}
                      disabled={loading}
                    />
                    <input
                      type="text"
                      value={formData.secondaryColor}
                      onChange={(e) => handleColorInputChange(e.target.value, 'secondary')}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                      placeholder="hex, rgb(r,g,b), hsl(h,s%,l%)"
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    Formats: #FF0000, rgb(255,0,0), hsl(0,100%,50%)
                  </div>
                  
                  {showSecondaryColorPicker && (
                    <div className="relative">
                      <div className="absolute top-2 right-2 z-10">
                        <button
                          type="button"
                          onClick={() => setShowSecondaryColorPicker(false)}
                          className="p-1 bg-white rounded-full shadow-md hover:bg-gray-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <HexColorPicker
                        color={formData.secondaryColor}
                        onChange={(color) => handleColorSelect(color, 'secondary')}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Brand Preview */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Brand Preview</h4>
              <div className="flex items-center gap-4">
                {formData.logoPreview && (
                  <img 
                    src={formData.logoPreview} 
                    alt="Brand preview"
                    className="w-10 h-10 object-contain"
                  />
                )}
                <div 
                  className="px-4 py-2 rounded text-white text-sm font-medium"
                  style={{ backgroundColor: formData.primaryColor }}
                >
                  Primary Button
                </div>
                <div 
                  className="px-4 py-2 rounded border-2 text-sm font-medium"
                  style={{ 
                    borderColor: formData.secondaryColor,
                    color: formData.secondaryColor 
                  }}
                >
                  Secondary Button
                </div>
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
              disabled={loading || uploadingLogo}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {uploadingLogo ? "Uploading Logo..." : "Creating District..."}
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
            <li>• The district will be created with custom branding</li>
            <li>• A District Admin account will be created for the POC</li>
            <li>• The POC can log in immediately with their credentials</li>
            <li>• District branding will appear throughout the system</li>
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