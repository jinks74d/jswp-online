// components/dashboard/classes/BulkClassUpload.tsx
"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
import {
  Upload,
  FileText,
  Download,
  AlertCircle,
  CheckCircle,
  X,
  Loader2,
  FileSpreadsheet,
  Link as LinkIcon,
} from "lucide-react";

interface UploadResult {
  success: boolean;
  message: string;
  stats?: {
    totalRows: number;
    subjectsCreated: number;
    classesCreated: number;
    classPeriodsCreated: number;
    teachersAssigned: number;
    errors: string[];
    warnings: string[];
  };
}

interface BulkClassUploadProps {
  schoolId: string;
  schoolName: string;
  onUploadComplete?: () => void;
}

export default function BulkClassUpload({
  schoolId,
  schoolName,
  onUploadComplete,
}: BulkClassUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [uploadMethod, setUploadMethod] = useState<"file" | "url">("file");
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const downloadTemplate = () => {
    const csvContent = `subject_name,class_name,period,teacher_email,subject_description
Mathematics,Algebra I,1st Period,john.smith@school.edu,Introduction to algebraic concepts
Mathematics,Geometry,2nd Period,jane.doe@school.edu,Plane and solid geometry
English Language Arts,English 9A,3rd Period,mary.johnson@school.edu,Freshman English literature and composition
Science,Biology,4th Period,robert.wilson@school.edu,General biology for high school students
History,World History,5th Period,sarah.brown@school.edu,Survey of world civilizations`;

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${schoolName.replace(/\s+/g, "_")}_class_upload_template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (
      !validTypes.includes(file.type) &&
      !file.name.match(/\.(csv|xlsx|xls)$/i)
    ) {
      setResult({
        success: false,
        message: "Please upload a CSV or Excel file (.csv, .xlsx, .xls)",
      });
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("schoolId", schoolId);

      const response = await fetch("/api/school-admin/classes/bulk-upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      setResult(result);

      if (result.success && onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error("Upload error:", error);
      setResult({
        success: false,
        message: "Upload failed. Please try again.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleGoogleSheetsUpload = async () => {
    if (!googleSheetsUrl.trim()) {
      setResult({
        success: false,
        message: "Please enter a Google Sheets URL",
      });
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const response = await fetch(
        "/api/school-admin/classes/bulk-upload-sheets",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sheetsUrl: googleSheetsUrl,
            schoolId: schoolId,
          }),
        }
      );

      const result = await response.json();
      setResult(result);

      if (result.success && onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error("Google Sheets upload error:", error);
      setResult({
        success: false,
        message: "Google Sheets upload failed. Please try again.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
      >
        <Upload className="w-4 h-4" />
        Bulk Upload Classes
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Bulk Upload Classes
          </h2>
          <button
            onClick={() => {
              setIsOpen(false);
              setResult(null);
              setGoogleSheetsUrl("");
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Upload Method Selection */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Choose Upload Method
            </h3>
            <div className="flex gap-4">
              <button
                onClick={() => setUploadMethod("file")}
                className={`flex-1 p-4 border-2 rounded-lg transition-colors ${
                  uploadMethod === "file"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <FileSpreadsheet className="w-6 h-6 mx-auto mb-2" />
                <div className="font-medium">File Upload</div>
                <div className="text-sm text-gray-600">CSV or Excel file</div>
              </button>
              <button
                onClick={() => setUploadMethod("url")}
                className={`flex-1 p-4 border-2 rounded-lg transition-colors ${
                  uploadMethod === "url"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <LinkIcon className="w-6 h-6 mx-auto mb-2" />
                <div className="font-medium">Google Sheets</div>
                <div className="text-sm text-gray-600">Share URL</div>
              </button>
            </div>
          </div>

          {/* Template Download */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-blue-900 mb-1">
                  Download Template First
                </h4>
                <p className="text-sm text-blue-800 mb-3">
                  Use our template to ensure your data is formatted correctly.
                </p>
                <button
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  <Download className="w-4 h-4" />
                  Download CSV Template
                </button>
              </div>
            </div>
          </div>

          {/* File Upload */}
          {uploadMethod === "file" && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Upload File</h4>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={(e) => e.preventDefault()}
              >
                {uploading ? (
                  <div className="space-y-3">
                    <Loader2 className="w-12 h-12 text-blue-600 mx-auto animate-spin" />
                    <p className="text-gray-600">Processing your file...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto" />
                    <div>
                      <p className="text-lg font-medium text-gray-900 mb-1">
                        Drop your file here or click to browse
                      </p>
                      <p className="text-sm text-gray-600">
                        Supports CSV, Excel (.xlsx, .xls) files
                      </p>
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      disabled={uploading}
                    >
                      <Upload className="w-4 h-4" />
                      Choose File
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploading}
                />
              </div>
            </div>
          )}

          {/* Google Sheets Upload */}
          {uploadMethod === "url" && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">
                Google Sheets URL
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Share URL
                  </label>
                  <input
                    type="url"
                    value={googleSheetsUrl}
                    onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    disabled={uploading}
                  />
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Make sure your Google Sheet is shared
                    with "Anyone with the link can view" permissions.
                  </p>
                </div>
                <button
                  onClick={handleGoogleSheetsUpload}
                  disabled={uploading || !googleSheetsUrl.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload from Google Sheets
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div
              className={`border rounded-lg p-4 ${
                result.success
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <h4
                    className={`font-medium mb-2 ${
                      result.success ? "text-green-900" : "text-red-900"
                    }`}
                  >
                    {result.success ? "Upload Successful!" : "Upload Failed"}
                  </h4>
                  <p
                    className={`text-sm mb-3 ${
                      result.success ? "text-green-800" : "text-red-800"
                    }`}
                  >
                    {result.message}
                  </p>

                  {result.stats && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Total Rows:</span>{" "}
                          {result.stats.totalRows}
                        </div>
                        <div>
                          <span className="font-medium">Subjects Created:</span>{" "}
                          {result.stats.subjectsCreated}
                        </div>
                        <div>
                          <span className="font-medium">Classes Created:</span>{" "}
                          {result.stats.classesCreated}
                        </div>
                        <div>
                          <span className="font-medium">Periods Created:</span>{" "}
                          {result.stats.classPeriodsCreated}
                        </div>
                        <div>
                          <span className="font-medium">
                            Teachers Assigned:
                          </span>{" "}
                          {result.stats.teachersAssigned}
                        </div>
                      </div>

                      {result.stats.warnings.length > 0 && (
                        <div className="mt-3">
                          <h5 className="font-medium text-yellow-800 mb-1">
                            Warnings:
                          </h5>
                          <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
                            {result.stats.warnings.map((warning, index) => (
                              <li key={index}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {result.stats.errors.length > 0 && (
                        <div className="mt-3">
                          <h5 className="font-medium text-red-800 mb-1">
                            Errors:
                          </h5>
                          <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                            {result.stats.errors.map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Required Fields Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Required Fields</h4>
            <div className="text-sm text-gray-700 space-y-1">
              <div>
                <strong>subject_name:</strong> Name of the subject/course
              </div>
              <div>
                <strong>class_name:</strong> Name of the specific class
              </div>
              <div>
                <strong>period:</strong> Class period or time slot
              </div>
              <div className="mt-2 text-gray-600">
                <strong>Optional:</strong> teacher_email, subject_description
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={() => {
              setIsOpen(false);
              setResult(null);
              setGoogleSheetsUrl("");
            }}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
