// components/dashboard/schools/SchoolsList.tsx
"use client";

import { useState } from "react";
import {
  Building2,
  Plus,
  Search,
  Users,
  Calendar,
  MapPin,
  MoreVertical,
} from "lucide-react";
import Link from "next/link";

interface School {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
  settings: Record<string, any>;
  user_count: number;
}

interface DistrictBranding {
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
}

interface SchoolsListProps {
  schools: School[];
  districtName: string;
  districtBranding: DistrictBranding;
}

export default function SchoolsList({
  schools = [],
  districtName,
  districtBranding,
}: SchoolsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  
  // District branding
  const districtSecondaryColor = districtBranding.secondary_color || '#64748B';

  const filteredSchools = schools.filter(
    (school) =>
      school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (school.address &&
        school.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Schools</h1>
          <p className="text-gray-600 mt-1">Manage schools in {districtName}</p>
        </div>
        <Link
          href="/dashboard/schools/create"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add School
        </Link>
      </div>

      {/* Search and Stats */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search schools..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="text-sm text-gray-600">
          {filteredSchools.length} of {schools.length} schools
        </div>
      </div>

      {/* Schools Grid/List */}
      {filteredSchools.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center" style={{ border: `2px solid ${districtSecondaryColor}` }}>
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm ? "No schools found" : "No schools yet"}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm
              ? "Try adjusting your search terms"
              : "Get started by adding your first school to the district"}
          </p>
          {!searchTerm && (
            <Link
              href="/dashboard/schools/create"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add First School
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSchools.map((school) => (
            <div
              key={school.id}
              className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
              style={{ border: `2px solid ${districtSecondaryColor}` }}
            >
              {/* School Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {school.name}
                    </h3>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      Added {new Date(school.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>

              {/* School Details */}
              <div className="space-y-3">
                {school.address && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{school.address}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>{school.user_count || 0} users</span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/schools/${school.id}`}
                    className="flex-1 text-center bg-blue-50 text-blue-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                  >
                    View Details
                  </Link>
                  <Link
                    href={`/dashboard/schools/${school.id}/users`}
                    className="flex-1 text-center bg-gray-50 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
                  >
                    Manage Users
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {schools.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6" style={{ border: `2px solid ${districtSecondaryColor}` }}>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            District Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {schools.length}
              </div>
              <div className="text-sm text-gray-600">Total Schools</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {schools.reduce(
                  (total, school) => total + (school.user_count || 0),
                  0
                )}
              </div>
              <div className="text-sm text-gray-600">Total Users</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {schools.length > 0
                  ? Math.round(
                      schools.reduce(
                        (total, school) => total + (school.user_count || 0),
                        0
                      ) / schools.length
                    )
                  : 0}
              </div>
              <div className="text-sm text-gray-600">Avg Users per School</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
