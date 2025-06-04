// components/dashboard/schools/SchoolUsersManagement.tsx
"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Users,
  Plus,
  Search,
  Filter,
  Mail,
  Calendar,
  MoreVertical,
  UserPlus,
  UserMinus,
  Building2,
} from "lucide-react";
import Link from "next/link";
import { UserRole } from "@/lib/supabase";
import { createClient } from "@/lib/supabase";

interface User {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: UserRole;
  created_at: string;
}

interface School {
  id: string;
  name: string;
  address: string | null;
  districts?: {
    id: string;
    name: string;
  };
}

interface SchoolUsersManagementProps {
  school: School;
  users: User[];
  unassignedUsers: User[];
  currentUserRole: UserRole;
  districtName: string;
}

const getRoleDisplayName = (role: UserRole): string => {
  switch (role) {
    case "district_admin":
      return "District Admin";
    case "school_admin":
      return "School Admin";
    case "teacher":
      return "Teacher";
    case "student":
      return "Student";
    default:
      return role;
  }
};

const getRoleBadgeColor = (role: UserRole): string => {
  switch (role) {
    case "district_admin":
      return "bg-purple-100 text-purple-800";
    case "school_admin":
      return "bg-blue-100 text-blue-800";
    case "teacher":
      return "bg-green-100 text-green-800";
    case "student":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export default function SchoolUsersManagement({
  school,
  users: initialUsers,
  unassignedUsers: initialUnassignedUsers,
  currentUserRole,
  districtName,
}: SchoolUsersManagementProps) {
  const [users, setUsers] = useState(initialUsers);
  const [unassignedUsers, setUnassignedUsers] = useState(
    initialUnassignedUsers
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [showAssignUsers, setShowAssignUsers] = useState(false);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      (user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ??
        false) ||
      (user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ??
        false) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === "all" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const userStats = {
    total: users.length,
    school_admin: users.filter((u) => u.role === "school_admin").length,
    teacher: users.filter((u) => u.role === "teacher").length,
    student: users.filter((u) => u.role === "student").length,
  };

  const assignUserToSchool = async (userId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ school_id: school.id })
        .eq("id", userId);

      if (error) throw error;

      // Move user from unassigned to assigned
      const userToMove = unassignedUsers.find((u) => u.id === userId);
      if (userToMove) {
        setUsers((prev) => [...prev, userToMove]);
        setUnassignedUsers((prev) => prev.filter((u) => u.id !== userId));
      }
    } catch (error) {
      console.error("Error assigning user to school:", error);
      alert("Failed to assign user to school");
    } finally {
      setLoading(false);
    }
  };

  const removeUserFromSchool = async (userId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ school_id: null })
        .eq("id", userId);

      if (error) throw error;

      // Move user from assigned to unassigned
      const userToMove = users.find((u) => u.id === userId);
      if (userToMove) {
        setUnassignedUsers((prev) => [...prev, userToMove]);
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      }
    } catch (error) {
      console.error("Error removing user from school:", error);
      alert("Failed to remove user from school");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/dashboard/schools/${school.id}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to School Details
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Manage Users</h1>
              <p className="text-gray-600">
                {school.name} • {districtName}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {unassignedUsers.length > 0 && (
            <button
              onClick={() => setShowAssignUsers(!showAssignUsers)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <UserPlus className="w-5 h-5" />
              Assign Users ({unassignedUsers.length})
            </button>
          )}
          <Link
            href="/dashboard/users/invite"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create User
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-xl font-bold text-gray-900">
                {userStats.total}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">School Admins</p>
              <p className="text-xl font-bold text-gray-900">
                {userStats.school_admin}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Teachers</p>
              <p className="text-xl font-bold text-gray-900">
                {userStats.teacher}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Students</p>
              <p className="text-xl font-bold text-gray-900">
                {userStats.student}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Assign Users Panel */}
      {showAssignUsers && unassignedUsers.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Assign Existing Users to {school.name}
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            These users are in your district but not assigned to any school yet.
          </p>
          <div className="space-y-3">
            {unassignedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">
                      {user.first_name?.[0] || user.email[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {user.first_name} {user.last_name}
                    </h4>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3 h-3 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {user.email}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                          user.role
                        )}`}
                      >
                        {getRoleDisplayName(user.role)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => assignUserToSchool(user.id)}
                  disabled={loading}
                  className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  Assign
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Role Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <select
              value={roleFilter}
              onChange={(e) =>
                setRoleFilter(e.target.value as UserRole | "all")
              }
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="school_admin">School Admins</option>
              <option value="teacher">Teachers</option>
              <option value="student">Students</option>
            </select>
          </div>

          <div className="text-sm text-gray-600 flex items-center">
            {filteredUsers.length} of {users.length} users
          </div>
        </div>
      </div>

      {/* Users List */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm || roleFilter !== "all"
              ? "No users found"
              : "No users assigned"}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || roleFilter !== "all"
              ? "Try adjusting your search terms or filters"
              : "This school doesn't have any users assigned yet."}
          </p>
          {!searchTerm && roleFilter === "all" && (
            <div className="flex justify-center gap-3">
              {unassignedUsers.length > 0 && (
                <button
                  onClick={() => setShowAssignUsers(true)}
                  className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <UserPlus className="w-5 h-5" />
                  Assign Existing Users
                </button>
              )}
              <Link
                href="/dashboard/users/invite"
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create New User
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                          <span className="text-sm font-medium text-gray-600">
                            {user.first_name?.[0] ||
                              user.email[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                          user.role
                        )}`}
                      >
                        {getRoleDisplayName(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                        {new Date(user.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/users/${user.id}/edit`}
                          className="text-blue-600 hover:text-blue-700"
                          title="Edit user"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </Link>
                        <button
                          onClick={() => removeUserFromSchool(user.id)}
                          disabled={loading}
                          className="text-red-600 hover:text-red-700 disabled:opacity-50"
                          title="Remove from school"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                        <button className="text-gray-400 hover:text-gray-600">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
