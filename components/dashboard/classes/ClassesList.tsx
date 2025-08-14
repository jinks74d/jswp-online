// components/dashboard/classes/ClassesList.tsx
"use client";

import { useState } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Calendar,
  Users,
  Clock,
  Edit,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { UserProfile } from "@/lib/supabase";
import BulkClassUpload from "./BulkClassUpload";

interface ClassPeriod {
  id: string;
  period: string;
  school_id: string;
  created_at: string;
  studentCount?: number;
  classes: {
    id: string;
    name: string;
    subjects: {
      id: string;
      name: string;
    };
  };
}

interface DistrictBranding {
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
}

interface ClassesListProps {
  classPeriods: ClassPeriod[];
  profile: UserProfile & {
    districts?: {
      id: string;
      name: string;
      domain: string | null;
      logo_url: string | null;
      primary_color: string | null;
      secondary_color: string | null;
    };
    schools?: {
      id: string;
      name: string;
      primary_color?: string | null;
      secondary_color?: string | null;
      logo_url?: string | null;
    };
  };
  districtBranding: DistrictBranding;
  onRefresh?: () => void;
}

export default function ClassesList({
  classPeriods,
  profile,
  districtBranding,
  onRefresh,
}: ClassesListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");

  // School branding with district fallback
  const schoolSecondaryColor =
    profile.schools?.secondary_color ||
    districtBranding.secondary_color ||
    "#64748B";

  // Get unique subjects for filtering
  const subjects = Array.from(
    new Set(classPeriods.map((cp) => cp.classes.subjects.name))
  ).sort();

  const filteredClassPeriods = classPeriods.filter((classPeriod) => {
    const matchesSearch =
      classPeriod.classes.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      classPeriod.classes.subjects.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      classPeriod.period.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSubject =
      subjectFilter === "all" ||
      classPeriod.classes.subjects.name === subjectFilter;

    return matchesSearch && matchesSubject;
  });

  const canManageClasses = [
    "school_admin",
    "district_admin",
    "teacher",
  ].includes(profile.role);

  // Group class periods by subject for better organization
  const groupedBySubject = filteredClassPeriods.reduce((acc, classPeriod) => {
    const subjectName = classPeriod.classes.subjects.name;
    if (!acc[subjectName]) {
      acc[subjectName] = [];
    }
    acc[subjectName].push(classPeriod);
    return acc;
  }, {} as Record<string, ClassPeriod[]>);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className="bg-white rounded-lg shadow-sm p-4"
          style={{ border: `2px solid ${schoolSecondaryColor}` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Classes</p>
              <p className="text-xl font-bold text-gray-900">
                {classPeriods.length}
              </p>
            </div>
          </div>
        </div>

        <div
          className="bg-white rounded-lg shadow-sm p-4"
          style={{ border: `2px solid ${schoolSecondaryColor}` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Subjects</p>
              <p className="text-xl font-bold text-gray-900">
                {subjects.length}
              </p>
            </div>
          </div>
        </div>

        <div
          className="bg-white rounded-lg shadow-sm p-4"
          style={{ border: `2px solid ${schoolSecondaryColor}` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Periods</p>
              <p className="text-xl font-bold text-gray-900">
                {
                  Array.from(new Set(classPeriods.map((cp) => cp.period)))
                    .length
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Class Periods</h2>
          <p className="text-gray-600 text-sm">
            {filteredClassPeriods.length} of {classPeriods.length} class periods
          </p>
        </div>
        {canManageClasses && (
          <div className="flex items-center gap-3">
            {profile.school_id && (
              <BulkClassUpload
                schoolId={profile.school_id}
                schoolName={profile.schools?.name || "School"}
                onUploadComplete={onRefresh}
              />
            )}
            <Link
              href="/dashboard/classes/create"
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Class
            </Link>
          </div>
        )}
      </div>

      {/* Filters */}
      <div
        className="bg-white rounded-lg shadow-sm p-4"
        style={{ border: `2px solid ${schoolSecondaryColor}` }}
      >
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search classes, subjects, or periods..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
          </div>

          {/* Subject Filter */}
          {subjects.length > 0 && (
            <div className="relative">
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              >
                <option value="all">All Subjects</option>
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Classes List */}
      {filteredClassPeriods.length === 0 ? (
        <div
          className="bg-white rounded-lg shadow-sm p-12 text-center"
          style={{ border: `2px solid ${schoolSecondaryColor}` }}
        >
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm || subjectFilter !== "all"
              ? "No classes found"
              : "No classes yet"}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || subjectFilter !== "all"
              ? "Try adjusting your search terms or filters"
              : "Get started by creating your first class period"}
          </p>
          {!searchTerm && subjectFilter === "all" && canManageClasses && (
            <Link
              href="/dashboard/classes/create"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create First Class
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedBySubject).map(
            ([subjectName, subjectClassPeriods]) => (
              <div
                key={subjectName}
                className="bg-white rounded-lg shadow-sm"
                style={{ border: `2px solid ${schoolSecondaryColor}` }}
              >
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {subjectName}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {subjectClassPeriods.length} class period
                    {subjectClassPeriods.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {subjectClassPeriods.map((classPeriod) => (
                      <div
                        key={classPeriod.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <BookOpen className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {classPeriod.classes.name}
                              </h4>
                              <p className="text-sm text-gray-600">
                                Period {classPeriod.period}
                              </p>
                            </div>
                          </div>
                          {canManageClasses && (
                            <div className="flex items-center gap-1">
                              <button className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button className="p-1 text-gray-400 hover:text-red-600 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>
                              Created{" "}
                              {new Date(
                                classPeriod.created_at
                              ).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>
                              {classPeriod.studentCount || 0} students enrolled
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-gray-200">
                          <Link
                            href={`/dashboard/classes/${classPeriod.id}`}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            View Details →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
