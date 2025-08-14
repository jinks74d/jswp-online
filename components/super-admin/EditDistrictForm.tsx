// components/super-admin/EditDistrictForm.tsx
"use client";

import { useState, useRef } from "react";
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
  Save,
} from "lucide-react";
import Link from "next/link";
import { HexColorPicker } from "react-colorful";
import DistrictAdminManager from "./DistrictAdminManager";

interface District {
  id: string;
  name: string;
  domain: string | null;
  poc_email: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  created_at: string;
}

interface PocProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface EditDistrictFormProps {
  district: District;
  pocProfile: PocProfile | null;
}

interface FormData {
  name: string;
  domain: string;
  pocEmail: string;
  pocFirstName: string;
  pocLastName: string;
  logoFile: File | null;
  logoPreview: string | null;
  primaryColor: string;
  secondaryColor: string;
}

// Color conversion utilities (reusing from create form)
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

const rgbToHex = (r: number, g: number, b: number) => {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

const hslToRgb = (h: number, s: number, l: number) => {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;

  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return { r, g, b };
};

const parseColorInput = (input: string): string | null => {
  input = input.trim();

  if (input.match(/^#?[0-9A-Fa-f]{6}$/)) {
    return input.startsWith("#") ? input : `#${input}`;
  }

  const rgbMatch = input.match(/rgb\(?\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)?/i);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]);
    const g = parseInt(rgbMatch[2]);
    const b = parseInt(rgbMatch[3]);
    if (r <= 255 && g <= 255 && b <= 255) {
      return rgbToHex(r, g, b);
    }
  }

  const hslMatch = input.match(
    /hsl\(?\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*\)?/i
  );
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

export default function EditDistrictForm({
  district,
  pocProfile,
}: EditDistrictFormProps) {
  const [formData, setFormData] = useState<FormData>({
    name: district.name,
    domain: district.domain || "",
    pocEmail: district.poc_email,
    pocFirstName: pocProfile?.first_name || "",
    pocLastName: pocProfile?.last_name || "",
    logoFile: null,
    logoPreview: district.logo_url,
    primaryColor: district.primary_color || "#0B2559",
    secondaryColor: district.secondary_color || "#1e40af",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPrimaryColorPicker, setShowPrimaryColorPicker] = useState(false);
  const [showSecondaryColorPicker, setShowSecondaryColorPicker] =
    useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [domainCheckStatus, setDomainCheckStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Check domain availability when domain changes (only if different from current)
    if (name === "domain" && value.trim() !== district.domain) {
      checkDomainAvailability(value);
    }
  };

  const checkDomainAvailability = async (domain: string) => {
    if (!domain.trim() || !domain.includes(".")) {
      setDomainCheckStatus("idle");
      return;
    }

    // If domain is the same as current district domain, don't check
    if (domain.trim() === district.domain) {
      setDomainCheckStatus("idle");
      return;
    }

    setDomainCheckStatus("checking");

    try {
      const response = await fetch("/api/super-admin/districts/check-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: domain.trim(),
          excludeDistrictId: district.id,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setDomainCheckStatus(result.available ? "available" : "taken");
      } else {
        setDomainCheckStatus("idle");
      }
    } catch (error) {
      console.error("Error checking domain:", error);
      setDomainCheckStatus("idle");
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError("Logo file must be less than 5MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setFormData((prev) => ({
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
    setFormData((prev) => ({
      ...prev,
      logoFile: null,
      logoPreview: null,
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleColorSelect = (color: string, type: "primary" | "secondary") => {
    setFormData((prev) => ({
      ...prev,
      [type === "primary" ? "primaryColor" : "secondaryColor"]: color,
    }));
  };

  const handleColorInputChange = (
    input: string,
    type: "primary" | "secondary"
  ) => {
    const parsedColor = parseColorInput(input);
    if (parsedColor) {
      handleColorSelect(parsedColor, type);
    } else {
      setFormData((prev) => ({
        ...prev,
        [type === "primary" ? "primaryColor" : "secondaryColor"]: input,
      }));
    }
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return "District name is required";
    if (!formData.pocEmail.trim()) return "POC email is required";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.pocEmail)) {
      return "Please enter a valid email address";
    }

    if (formData.domain && !formData.domain.includes(".")) {
      return "Please enter a valid domain (e.g., schooldistrict.edu)";
    }

    // Only check domain availability if domain has changed and it's marked as taken
    if (
      formData.domain.trim() !== district.domain &&
      domainCheckStatus === "taken"
    ) {
      return "This domain is already in use by another district";
    }

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

  const uploadLogoToStorage = async (
    file: File,
    districtId: string
  ): Promise<string | null> => {
    try {
      setUploadingLogo(true);

      // Create FormData for the API request
      const formData = new FormData();
      formData.append("logo", file);

      // Upload via our API route
      const response = await fetch(`/api/districts/${districtId}/upload-logo`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Upload API error:", result.error);
        setError(result.error || "Failed to upload logo");
        return null;
      }

      return result.logo_url;
    } catch (error) {
      console.error("Error uploading logo:", error);
      setError("Failed to upload logo");
      return null;
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    console.log("=== FORM SUBMISSION STARTED ===");
    console.log("Form data:", formData);
    console.log("Domain check status:", domainCheckStatus);

    try {
      const validationError = validateForm();
      if (validationError) {
        console.error("Validation error:", validationError);
        throw new Error(validationError);
      }

      const validPrimaryColor = parseColorInput(formData.primaryColor);
      const validSecondaryColor = parseColorInput(formData.secondaryColor);

      console.log("=== UPDATING DISTRICT BASIC INFO ===");
      console.log("District ID:", district.id);
      console.log("Update data:", {
        name: formData.name.trim(),
        domain: formData.domain.trim() || null,
        poc_email: formData.pocEmail.trim(),
        primary_color: validPrimaryColor,
        secondary_color: validSecondaryColor,
      });

      // Update district basic info
      const { error: updateError } = await supabase
        .from("districts")
        .update({
          name: formData.name.trim(),
          domain: formData.domain.trim() || null,
          poc_email: formData.pocEmail.trim(),
          primary_color: validPrimaryColor,
          secondary_color: validSecondaryColor,
        })
        .eq("id", district.id);

      if (updateError) {
        console.error("District update error:", updateError);
        throw new Error(`Failed to update district: ${updateError.message}`);
      }

      console.log("District basic info updated successfully");

      // Update POC profile if exists
      if (
        pocProfile &&
        (formData.pocFirstName.trim() || formData.pocLastName.trim())
      ) {
        console.log("=== UPDATING POC PROFILE ===");
        console.log("POC Profile ID:", pocProfile.id);
        console.log("POC Update data:", {
          first_name: formData.pocFirstName.trim(),
          last_name: formData.pocLastName.trim(),
          email: formData.pocEmail.trim(),
        });

        const { error: profileUpdateError } = await supabase
          .from("user_profiles")
          .update({
            first_name: formData.pocFirstName.trim(),
            last_name: formData.pocLastName.trim(),
            email: formData.pocEmail.trim(),
          })
          .eq("id", pocProfile.id);

        if (profileUpdateError) {
          console.error("Error updating POC profile:", profileUpdateError);
        } else {
          console.log("POC profile updated successfully");
        }
      }

      // Handle logo upload/removal
      if (formData.logoFile) {
        console.log("=== UPLOADING NEW LOGO ===");
        console.log(
          "Logo file:",
          formData.logoFile.name,
          formData.logoFile.size
        );

        const logoUrl = await uploadLogoToStorage(
          formData.logoFile,
          district.id
        );

        if (logoUrl) {
          console.log(
            "Logo uploaded successfully, updating district with URL:",
            logoUrl
          );
          const { error: logoUpdateError } = await supabase
            .from("districts")
            .update({ logo_url: logoUrl })
            .eq("id", district.id);

          if (logoUpdateError) {
            console.error(
              "Error updating district with logo:",
              logoUpdateError
            );
          } else {
            console.log("District logo URL updated successfully");
          }
        }
      } else if (formData.logoPreview === null && district.logo_url) {
        // Logo was removed
        console.log("=== REMOVING LOGO ===");
        console.log("Removing logo from district:", district.id);

        const { error: logoRemoveError } = await supabase
          .from("districts")
          .update({ logo_url: null })
          .eq("id", district.id);

        if (logoRemoveError) {
          console.error("Error removing logo:", logoRemoveError);
        } else {
          console.log("Logo removed successfully");
        }
      }

      console.log("=== FORM SUBMISSION COMPLETED SUCCESSFULLY ===");
      setSuccess(true);

      setTimeout(() => {
        router.push("/super-admin/districts");
      }, 2000);
    } catch (error: any) {
      console.error("=== FORM SUBMISSION FAILED ===");
      console.error("Error updating district:", error);
      setError(
        error.message || "An error occurred while updating the district"
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
            District Updated Successfully!
          </h2>
          <p className="text-gray-600 mb-6">
            The district "{formData.name}" has been updated with the new
            information.
          </p>
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
        <h1 className="text-3xl font-bold text-gray-900">Edit District</h1>
        <p className="text-gray-600 mt-1">
          Update district information and branding
        </p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm border-2 border-[#0B2559] p-8">
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
                        domainCheckStatus === "taken"
                          ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                          : domainCheckStatus === "available"
                          ? "border-green-300 focus:ring-green-500 focus:border-green-500"
                          : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                      }`}
                      placeholder="schooldistrict.edu"
                      disabled={loading}
                    />
                    <div className="absolute right-3 top-2.5">
                      {domainCheckStatus === "checking" && (
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      )}
                      {domainCheckStatus === "available" && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                      {domainCheckStatus === "taken" && (
                        <X className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                  </div>
                  <div className="mt-1">
                    {domainCheckStatus === "taken" && (
                      <p className="text-xs text-red-600">
                        This domain is already in use by another district
                      </p>
                    )}
                    {domainCheckStatus === "available" && (
                      <p className="text-xs text-green-600">
                        Domain is available
                      </p>
                    )}
                    {(domainCheckStatus === "idle" ||
                      domainCheckStatus === "checking") && (
                      <p className="text-xs text-gray-500">
                        If specified, only users with this email domain can join
                        this district
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
                      ? "border-green-300 bg-green-50"
                      : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
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
                      onClick={() =>
                        setShowPrimaryColorPicker(!showPrimaryColorPicker)
                      }
                      className="w-12 h-12 rounded-lg border-2 border-gray-300 shadow-sm"
                      style={{ backgroundColor: formData.primaryColor }}
                      disabled={loading}
                    />
                    <input
                      type="text"
                      value={formData.primaryColor}
                      onChange={(e) =>
                        handleColorInputChange(e.target.value, "primary")
                      }
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
                        onChange={(color) =>
                          handleColorSelect(color, "primary")
                        }
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
                      onClick={() =>
                        setShowSecondaryColorPicker(!showSecondaryColorPicker)
                      }
                      className="w-12 h-12 rounded-lg border-2 border-gray-300 shadow-sm"
                      style={{ backgroundColor: formData.secondaryColor }}
                      disabled={loading}
                    />
                    <input
                      type="text"
                      value={formData.secondaryColor}
                      onChange={(e) =>
                        handleColorInputChange(e.target.value, "secondary")
                      }
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
                        onChange={(color) =>
                          handleColorSelect(color, "secondary")
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Brand Preview */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Brand Preview
              </h4>
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
                    color: formData.secondaryColor,
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
                    First Name
                  </label>
                  <input
                    type="text"
                    id="pocFirstName"
                    name="pocFirstName"
                    value={formData.pocFirstName}
                    onChange={handleInputChange}
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
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="pocLastName"
                    name="pocLastName"
                    value={formData.pocLastName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="Doe"
                    disabled={loading}
                  />
                </div>
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
                  {uploadingLogo ? "Uploading Logo..." : "Updating District..."}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Update District
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* District Administrators Management */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border-2 border-[#0B2559] p-8">
        <DistrictAdminManager
          districtId={district.id}
          districtName={district.name}
        />
      </div>
    </div>
  );
}
