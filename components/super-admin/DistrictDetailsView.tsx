// components/super-admin/DistrictDetailsView.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Globe,
  Mail,
  Calendar,
  Users,
  GraduationCap,
  BookOpen,
  Edit,
  Trash2,
  Phone,
  MapPin,
  Shield,
  UserCheck,
  School,
  Palette,
} from "lucide-react";
import Link from "next/link";
import DistrictLogo from "@/components/ui/DistrictLogo";
import DeleteConfirmationModal from "@/components/ui/DeleteConfirmationModal";

interface District {
  id: string;
  name: string;
  domain: string | null;
  poc_email: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  created_at: string;
  settings: Record<string, any>;
}

interface School {
  id: string;
  name: string;
  address: string | null;
  principal_name: string | null;
  principal_email: string | null;
  phone: string | null;
  created_at: string;
  settings: Record<string, any>;
}

interface Admin {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  school_id: string | null;
  created_at: string;
  schools?: {
    id: string;
    name: string;
  } | null;
}

interface DistrictDetailsViewProps {
  district: District;
  schools: School[];
  admins: Admin[];
  totalUsers: number;
  totalAssignments: number;
}

export default function DistrictDetailsView({
  district,
  schools,
  admins,
  totalUsers,
  totalAssignments,
}: DistrictDetailsViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'schools' | 'admins'>('overview');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const router = useRouter();

  const districtAdmins = admins.filter(admin => admin.role === 'district_admin');
  const schoolAdmins = admins.filter(admin => admin.role === 'school_admin');

  // District branding
  const districtSecondaryColor = district.secondary_color || '#0B2559';

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleDeleteDistrict = () => {
    setShowDeleteModal(true);
    setDeleteError("");
  };

  const confirmDeleteDistrict = async () => {
    try {
      const response = await fetch(`/api/super-admin/districts/${district.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete district");
      }

      // Success - redirect to districts list
      router.push("/super-admin/districts");
    } catch (error: any) {
      console.error("Error deleting district:", error);
      setDeleteError(error.message);
      throw error; // Re-throw to keep modal open
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/super-admin/districts"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Districts
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/super-admin/districts/edit/${district.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit District
          </Link>
          <button
            onClick={handleDeleteDistrict}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete District
          </button>
        </div>
      </div>

      {/* District Header Card */}
      <div 
        className="bg-white rounded-lg shadow-sm border-2 p-8"
        style={{ border: `2px solid ${districtSecondaryColor}` }}
      >
        <div className="flex items-start gap-6">
          <DistrictLogo
            districtId={district.id}
            districtName={district.name}
            size={160}
            className="flex-shrink-0"
          />
          
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {district.name}
                </h1>
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Created {formatDate(district.created_at)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {totalUsers} Users
                  </div>
                  <div className="flex items-center gap-1">
                    <School className="w-4 h-4" />
                    {schools.length} Schools
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  {district.domain && (
                    <div className="flex items-center gap-1 text-gray-700">
                      <Globe className="w-4 h-4" />
                      <span className="font-medium">{district.domain}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-gray-700">
                    <Mail className="w-4 h-4" />
                    <span>{district.poc_email}</span>
                  </div>
                </div>
              </div>
              
              {/* Brand Colors Preview */}
              {(district.primary_color || district.secondary_color) && (
                <div className="flex flex-col items-end gap-2">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Brand Colors
                  </div>
                  <div className="flex gap-2">
                    {district.primary_color && (
                      <div className="flex flex-col items-center gap-1">
                        <div 
                          className="w-8 h-8 rounded border-2 border-gray-200"
                          style={{ backgroundColor: district.primary_color }}
                          title={`Primary: ${district.primary_color}`}
                        />
                        <span className="text-xs text-gray-500 font-mono">
                          {district.primary_color}
                        </span>
                      </div>
                    )}
                    {district.secondary_color && (
                      <div className="flex flex-col items-center gap-1">
                        <div 
                          className="w-8 h-8 rounded border-2 border-gray-200"
                          style={{ backgroundColor: district.secondary_color }}
                          title={`Secondary: ${district.secondary_color}`}
                        />
                        <span className="text-xs text-gray-500 font-mono">
                          {district.secondary_color}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div 
          className="bg-white rounded-lg shadow-sm border-2 p-6"
          style={{ border: `2px solid ${districtSecondaryColor}` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
              <p className="text-sm text-gray-600">Total Users</p>
            </div>
          </div>
        </div>

        <div 
          className="bg-white rounded-lg shadow-sm border-2 p-6"
          style={{ border: `2px solid ${districtSecondaryColor}` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <School className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{schools.length}</p>
              <p className="text-sm text-gray-600">Schools</p>
            </div>
          </div>
        </div>

        <div 
          className="bg-white rounded-lg shadow-sm border-2 p-6"
          style={{ border: `2px solid ${districtSecondaryColor}` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{admins.length}</p>
              <p className="text-sm text-gray-600">Administrators</p>
            </div>
          </div>
        </div>

        <div 
          className="bg-white rounded-lg shadow-sm border-2 p-6"
          style={{ border: `2px solid ${districtSecondaryColor}` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalAssignments}</p>
              <p className="text-sm text-gray-600">Assignments</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div 
        className="bg-white rounded-lg shadow-sm border-2 overflow-hidden"
        style={{ border: `2px solid ${districtSecondaryColor}` }}
      >
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Overview
              </div>
            </button>
            <button
              onClick={() => setActiveTab('schools')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'schools'
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <School className="w-4 h-4" />
                Schools ({schools.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('admins')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'admins'
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Administrators ({admins.length})
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">District Information</h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">District Name</dt>
                      <dd className="text-sm text-gray-900 mt-1">{district.name}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Email Domain</dt>
                      <dd className="text-sm text-gray-900 mt-1">
                        {district.domain || 'No domain restriction'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Point of Contact</dt>
                      <dd className="text-sm text-gray-900 mt-1">{district.poc_email}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Created</dt>
                      <dd className="text-sm text-gray-900 mt-1">{formatDate(district.created_at)}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Total Users</span>
                      <span className="text-sm font-medium text-gray-900">{totalUsers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Schools</span>
                      <span className="text-sm font-medium text-gray-900">{schools.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">District Admins</span>
                      <span className="text-sm font-medium text-gray-900">{districtAdmins.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">School Admins</span>
                      <span className="text-sm font-medium text-gray-900">{schoolAdmins.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Assignments</span>
                      <span className="text-sm font-medium text-gray-900">{totalAssignments}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Schools Tab */}
          {activeTab === 'schools' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Schools in {district.name}</h3>
                <span className="text-sm text-gray-500">{schools.length} schools</span>
              </div>
              
              {schools.length === 0 ? (
                <div className="text-center py-12">
                  <School className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No Schools Yet</h4>
                  <p className="text-gray-600">This district doesn't have any schools configured.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {schools.map((school) => (
                    <div key={school.id} className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <School className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">{school.name}</h4>
                          {school.address && (
                            <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3" />
                              {school.address}
                            </p>
                          )}
                          {school.principal_name && (
                            <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                              <UserCheck className="w-3 h-3" />
                              {school.principal_name}
                            </p>
                          )}
                          {school.principal_email && (
                            <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                              <Mail className="w-3 h-3" />
                              {school.principal_email}
                            </p>
                          )}
                          {school.phone && (
                            <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                              <Phone className="w-3 h-3" />
                              {school.phone}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-2">
                            Created {formatDate(school.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Admins Tab */}
          {activeTab === 'admins' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Administrators</h3>
                <span className="text-sm text-gray-500">{admins.length} administrators</span>
              </div>

              {/* District Admins */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  District Administrators ({districtAdmins.length})
                </h4>
                {districtAdmins.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No district administrators</p>
                ) : (
                  <div className="space-y-2">
                    {districtAdmins.map((admin) => (
                      <div key={admin.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div>
                          <p className="font-medium text-gray-900">
                            {admin.first_name} {admin.last_name}
                          </p>
                          <p className="text-sm text-gray-600">{admin.email}</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            District Admin
                          </span>
                          <p className="text-xs text-gray-500 mt-1">
                            Since {formatDate(admin.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* School Admins */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <School className="w-4 h-4" />
                  School Administrators ({schoolAdmins.length})
                </h4>
                {schoolAdmins.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No school administrators</p>
                ) : (
                  <div className="space-y-2">
                    {schoolAdmins.map((admin) => (
                      <div key={admin.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                        <div>
                          <p className="font-medium text-gray-900">
                            {admin.first_name} {admin.last_name}
                          </p>
                          <p className="text-sm text-gray-600">{admin.email}</p>
                          {admin.schools && (
                            <p className="text-sm text-gray-500 flex items-center gap-1">
                              <School className="w-3 h-3" />
                              {admin.schools.name}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            School Admin
                          </span>
                          <p className="text-xs text-gray-500 mt-1">
                            Since {formatDate(admin.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteDistrict}
        title="Delete District"
        message={`Are you sure you want to delete "${district.name}"? This will permanently remove all district data including schools, users, and assignments.`}
        itemName={district.name}
        confirmText="DELETE"
      />

      {/* Delete Error Display */}
      {deleteError && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md">
          <p className="font-medium">Delete Failed</p>
          <p className="text-sm">{deleteError}</p>
        </div>
      )}
    </div>
  );
}