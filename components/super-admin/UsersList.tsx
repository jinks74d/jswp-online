// components/super-admin/UsersList.tsx
"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Filter,
  Users,
  Building2,
  School,
  Crown,
  Shield,
  GraduationCap,
  User,
  ChevronDown,
  X,
} from "lucide-react";

interface District {
  id: string;
  name: string;
  domain: string | null;
}

interface School {
  id: string;
  name: string;
}

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
  created_at: string;
  districts: District | null;
  schools: School | null;
}

interface UsersListProps {
  users: UserProfile[];
}

export default function UsersList({ users }: UsersListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [selectedSchool, setSelectedSchool] = useState<string>("all");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [sortBy, setSortBy] = useState<
    "name" | "email" | "role" | "created" | "district" | "school"
  >("district");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Extract unique districts and schools for filters
  const districts = useMemo(() => {
    const uniqueDistricts = users
      .filter((user) => user.districts)
      .reduce((acc, user) => {
        if (user.districts && !acc.find((d) => d.id === user.districts!.id)) {
          acc.push(user.districts);
        }
        return acc;
      }, [] as District[])
      .sort((a, b) => a.name.localeCompare(b.name));

    return uniqueDistricts;
  }, [users]);

  const schools = useMemo(() => {
    const filteredUsers =
      selectedDistrict === "all"
        ? users
        : users.filter((user) => user.districts?.id === selectedDistrict);

    const uniqueSchools = filteredUsers
      .filter((user) => user.schools)
      .reduce((acc, user) => {
        if (user.schools && !acc.find((s) => s.id === user.schools!.id)) {
          acc.push(user.schools);
        }
        return acc;
      }, [] as School[])
      .sort((a, b) => a.name.localeCompare(b.name));

    return uniqueSchools;
  }, [users, selectedDistrict]);

  const roles = useMemo(() => {
    const uniqueRoles = [
      ...new Set(users.map((user) => user.role).filter(Boolean)),
    ].sort();
    return uniqueRoles;
  }, [users]);

  // Filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users.filter((user) => {
      // Search filter
      const searchMatch =
        !searchTerm ||
        user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.districts?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.schools?.name.toLowerCase().includes(searchTerm.toLowerCase());

      // District filter
      const districtMatch =
        selectedDistrict === "all" ||
        (selectedDistrict === "none" && !user.districts) ||
        user.districts?.id === selectedDistrict;

      // School filter
      const schoolMatch =
        selectedSchool === "all" ||
        (selectedSchool === "none" && !user.schools) ||
        user.schools?.id === selectedSchool;

      // Role filter
      const roleMatch = selectedRole === "all" || user.role === selectedRole;

      return searchMatch && districtMatch && schoolMatch && roleMatch;
    });

    // Sort users
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case "name":
          aValue =
            `${a.first_name || ""} ${a.last_name || ""}`.trim() || a.email;
          bValue =
            `${b.first_name || ""} ${b.last_name || ""}`.trim() || b.email;
          break;
        case "email":
          aValue = a.email;
          bValue = b.email;
          break;
        case "role":
          aValue = a.role || "";
          bValue = b.role || "";
          break;
        case "created":
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case "district":
          aValue = a.districts?.name || "zzz"; // Put users without districts at the end
          bValue = b.districts?.name || "zzz";
          break;
        case "school":
          aValue = a.schools?.name || "zzz"; // Put users without schools at the end
          bValue = b.schools?.name || "zzz";
          break;
        default:
          aValue = a.email;
          bValue = b.email;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        const comparison = aValue.localeCompare(bValue);
        return sortOrder === "asc" ? comparison : -comparison;
      } else {
        const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return sortOrder === "asc" ? comparison : -comparison;
      }
    });

    return filtered;
  }, [
    users,
    searchTerm,
    selectedDistrict,
    selectedSchool,
    selectedRole,
    sortBy,
    sortOrder,
  ]);

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedDistrict("all");
    setSelectedSchool("all");
    setSelectedRole("all");
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "super_admin":
        return <Crown className="w-4 h-4" />;
      case "district_admin":
        return <Shield className="w-4 h-4" />;
      case "school_admin":
        return <Building2 className="w-4 h-4" />;
      case "teacher":
        return <GraduationCap className="w-4 h-4" />;
      case "student":
        return <User className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-red-100 text-red-800";
      case "district_admin":
        return "bg-purple-100 text-purple-800";
      case "school_admin":
        return "bg-blue-100 text-blue-800";
      case "teacher":
        return "bg-green-100 text-green-800";
      case "student":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const activeFiltersCount = [
    searchTerm,
    selectedDistrict !== "all" ? selectedDistrict : null,
    selectedSchool !== "all" ? selectedSchool : null,
    selectedRole !== "all" ? selectedRole : null,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">
            Manage all users across districts and schools
          </p>
        </div>
        <div className="text-sm text-gray-600">
          {filteredAndSortedUsers.length} of {users.length} users
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border-2 border-[#0B2559] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters & Search
            {activeFiltersCount > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {activeFiltersCount} active
              </span>
            )}
          </h2>
          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <X className="w-4 h-4" />
              Clear All
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, district, or school..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white placeholder-gray-500"
              />
            </div>
          </div>

          {/* District Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              District
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <select
                value={selectedDistrict}
                onChange={(e) => {
                  setSelectedDistrict(e.target.value);
                  setSelectedSchool("all"); // Reset school filter when district changes
                }}
                className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 appearance-none text-gray-900 bg-white"
              >
                <option value="all">All Districts</option>
                <option value="none">No District</option>
                {districts.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* School Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              School
            </label>
            <div className="relative">
              <School className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <select
                value={selectedSchool}
                onChange={(e) => setSelectedSchool(e.target.value)}
                className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 appearance-none text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                disabled={selectedDistrict !== "all" && schools.length === 0}
              >
                <option value="all">All Schools</option>
                <option value="none">No School</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Role Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <div className="relative">
              <Users className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 appearance-none text-gray-900 bg-white"
              >
                <option value="all">All Roles</option>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role
                      .replace("_", " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Sort Options */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Sort by:</span>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { key: "district", label: "District" },
                { key: "school", label: "School" },
                { key: "name", label: "Name" },
                { key: "role", label: "Role" },
                { key: "email", label: "Email" },
                { key: "created", label: "Created" },
              ].map((option) => (
                <button
                  key={option.key}
                  onClick={() => handleSort(option.key as typeof sortBy)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    sortBy === option.key
                      ? "bg-blue-100 text-blue-700 border border-blue-300"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"
                  }`}
                >
                  {option.label}
                  {sortBy === option.key && (
                    <span className="ml-1">
                      {sortOrder === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-lg shadow-sm border-2 border-[#0B2559]">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Users ({filteredAndSortedUsers.length})
          </h2>
        </div>
        <div className="p-6">
          {filteredAndSortedUsers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {users.length === 0
                  ? "No users found"
                  : "No users match your filters"}
              </h3>
              <p className="text-gray-600">
                {users.length === 0
                  ? "There are no users in the system yet."
                  : "Try adjusting your search terms or filters."}
              </p>
              {activeFiltersCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAndSortedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border-2 border-[#0B2559] rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">
                        {user.first_name?.[0] || user.email[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-medium text-gray-900">
                          {user.first_name && user.last_name
                            ? `${user.first_name} ${user.last_name}`
                            : user.email}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(
                            user.role
                          )}`}
                        >
                          {getRoleIcon(user.role)}
                          {user.role
                            .replace("_", " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{user.email}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {user.districts && (
                          <div className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            <span>{user.districts.name}</span>
                          </div>
                        )}
                        {user.schools && (
                          <div className="flex items-center gap-1">
                            <School className="w-3 h-3" />
                            <span>{user.schools.name}</span>
                          </div>
                        )}
                        <div>
                          Created{" "}
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
