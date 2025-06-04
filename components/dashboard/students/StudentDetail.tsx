// components/dashboard/students/StudentDetail.tsx
'use client'

import { ArrowLeft, Users, Building2, Calendar, Mail, Edit, GraduationCap } from 'lucide-react'
import Link from 'next/link'
import { UserRole } from '@/lib/supabase'
import StudentTeacherAssignments from './StudentTeacherAssignments'

interface Student {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  created_at: string
  schools?: { id: string; name: string } | null
  districts?: { id: string; name: string } | null
}

interface StudentDetailProps {
  student: Student
  currentUserRole: UserRole
  currentUserSchoolId?: string | null
  districtId: string
  districtName: string
}

export default function StudentDetail({
  student,
  currentUserRole,
  currentUserSchoolId,
  districtId,
  districtName
}: StudentDetailProps) {
  const canEdit = ['district_admin', 'school_admin'].includes(currentUserRole)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/students"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Students
        </Link>
      </div>

      {/* Student Profile Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {student.first_name} {student.last_name}
              </h1>
              <p className="text-gray-600">Student Profile</p>
            </div>
          </div>
          {canEdit && (
            <Link
              href={`/dashboard/users/${student.id}/edit`}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit Profile
            </Link>
          )}
        </div>

        {/* Student Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Contact Information</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="w-4 h-4" />
                  <span>{student.email}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Enrollment Details</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>Enrolled: {new Date(student.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">School Assignment</h3>
              <div className="space-y-2">
                {student.schools ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Building2 className="w-4 h-4" />
                    <span>{student.schools.name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-orange-600">
                    <Building2 className="w-4 h-4" />
                    <span>Not enrolled in any school</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">District</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600">
                  <Building2 className="w-4 h-4" />
                  <span>{districtName}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Status</p>
              <p className="text-lg font-bold text-blue-600">Active Student</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">School</p>
              <p className="text-lg font-bold text-gray-900">
                {student.schools ? 'Enrolled' : 'Not Enrolled'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Member Since</p>
              <p className="text-lg font-bold text-gray-900">
                {new Date(student.created_at).getFullYear()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Teacher Assignments */}
      <StudentTeacherAssignments
        studentId={student.id}
        currentUserRole={currentUserRole}
        currentUserSchoolId={currentUserSchoolId}
        districtId={districtId}
      />

      {/* Academic Overview - Coming Soon */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Academic Overview</h3>
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <GraduationCap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">Academic Records Coming Soon</h4>
          <p className="text-gray-600">
            Grade tracking, assignment submissions, and progress reports will be available here.
          </p>
        </div>
      </div>
    </div>
  )
}
