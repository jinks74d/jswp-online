// components/dashboard/DashboardSidebar.tsx
"use client";

import { useState } from "react";
import {
  Home,
  Building2,
  Users,
  GraduationCap,
  FileText,
  Settings,
  LogOut,
  BookOpen,
  UserPlus,
  School,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { UserProfile, UserRole } from "@/lib/supabase";
import DistrictLogo from "@/components/ui/DistrictLogo";

interface DashboardSidebarProps {
  profile: UserProfile & {
    districts?: {
      id: string;
      name: string;
      domain: string | null;
      logo_url: string | null;
      primary_color: string | null;
      secondary_color: string | null;
    };
    schools?: { id: string; name: string };
  };
}

// Navigation items based on user role
const getNavigationItems = (role: UserRole, pathname: string) => {
  const baseItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: Home,
      current: pathname === "/dashboard",
    },
  ];

  switch (role) {
    case "district_admin":
      return [
        ...baseItems,
        {
          name: "Schools",
          href: "/dashboard/schools",
          icon: School,
          current: pathname.startsWith("/dashboard/schools"),
        },
        {
          name: "Classes",
          href: "/dashboard/classes",
          icon: BookOpen,
          current: pathname.startsWith("/dashboard/classes"),
        },
        {
          name: "Users",
          href: "/dashboard/users",
          icon: Users,
          current: pathname.startsWith("/dashboard/users"),
        },
        {
          name: "Assignments",
          href: "/dashboard/assignments",
          icon: FileText,
          current: pathname.startsWith("/dashboard/assignments"),
        },
        {
          name: "Analytics",
          href: "/dashboard/analytics",
          icon: BarChart3,
          current: pathname.startsWith("/dashboard/analytics"),
        },
        {
          name: "Settings",
          href: "/dashboard/settings",
          icon: Settings,
          current: pathname.startsWith("/dashboard/settings"),
        },
      ];

    case "school_admin":
      return [
        ...baseItems,
        {
          name: "Classes",
          href: "/dashboard/classes",
          icon: BookOpen,
          current: pathname.startsWith("/dashboard/classes"),
        },
        {
          name: "Teachers",
          href: "/dashboard/teachers",
          icon: GraduationCap,
          current: pathname.startsWith("/dashboard/teachers"),
        },
        {
          name: "Students",
          href: "/dashboard/students",
          icon: Users,
          current: pathname.startsWith("/dashboard/students"),
        },
        {
          name: "Assignments",
          href: "/dashboard/assignments",
          icon: FileText,
          current: pathname.startsWith("/dashboard/assignments"),
        },
        {
          name: "Analytics",
          href: "/dashboard/analytics",
          icon: BarChart3,
          current: pathname.startsWith("/dashboard/analytics"),
        },
        {
          name: "Settings",
          href: "/dashboard/settings",
          icon: Settings,
          current: pathname.startsWith("/dashboard/settings"),
        },
      ];

    case "teacher":
      return [
        ...baseItems,
        {
          name: "My Classes",
          href: "/dashboard/classes",
          icon: BookOpen,
          current: pathname.startsWith("/dashboard/classes"),
        },
        {
          name: "Assignments",
          href: "/dashboard/assignments",
          icon: FileText,
          current: pathname.startsWith("/dashboard/assignments"),
        },
        {
          name: "Students",
          href: "/dashboard/students",
          icon: Users,
          current: pathname.startsWith("/dashboard/students"),
        },
      ];

    case "student":
      return [
        ...baseItems,
        {
          name: "My Assignments",
          href: "/dashboard/assignments",
          icon: FileText,
          current: pathname.startsWith("/dashboard/assignments"),
        },
        {
          name: "Classes",
          href: "/dashboard/classes",
          icon: BookOpen,
          current: pathname.startsWith("/dashboard/classes"),
        },
        {
          name: "My Grades",
          href: "/dashboard/grades",
          icon: GraduationCap,
          current: pathname.startsWith("/dashboard/grades"),
        },
      ];

    default:
      return baseItems;
  }
};

// Role display names
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
      return "User";
  }
};

export default function DashboardSidebar({ profile }: DashboardSidebarProps) {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);
  const { signOut } = useAuth();

  // Add null check for profile before accessing properties
  if (!profile) {
    return (
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-sidebar">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading sidebar...</p>
          </div>
        </div>
      </div>
    );
  }

  // Debug logging (now safe after null check)
  console.log("DashboardSidebar profile.districts:", profile.districts);
  console.log("DashboardSidebar full profile:", profile);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      // AuthProvider will handle the redirect with full page refresh
      // Set a timeout as a fallback in case redirect doesn't work
      setTimeout(() => {
        setSigningOut(false);
        if (typeof window !== "undefined") {
          window.location.href = "/";
        }
      }, 3000); // 3 second fallback
    } catch (error) {
      console.error("Error signing out:", error);
      // Show user-friendly error message
      alert("Failed to sign out. Please try again.");
      setSigningOut(false);
    }
  };

  const navigation = getNavigationItems(profile.role, pathname);
  const roleDisplayName = getRoleDisplayName(profile.role);

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-sidebar">
      {/* Logo and District Info */}
      <div className="flex flex-col h-20 justify-center px-6 border-b border-gray-200">
        <div className="flex items-center justify-center mb-1">
          <img
            src="/assets/jswp-logo.svg"
            alt="JSWP Online"
            className="w-full h-full max-w-none max-h-16"
          />
        </div>
        <p className="text-xs text-gray-600 truncate">
          {profile.districts?.name || "District Dashboard"}
        </p>
      </div>

      {/* Navigation */}
      <nav className="mt-6 px-4 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                item.current
                  ? "bg-gray-100 text-gray-800 border border-gray-300"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              style={item.current ? { backgroundColor: '#f8f9fa', color: '#455A64', borderColor: '#6b7280' } : {}}
            >
              <Icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Quick Actions for District/School Admins */}
      {(profile.role === "district_admin" ||
        profile.role === "school_admin") && (
        <div className="mt-8 px-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Quick Actions
          </h3>
          <div className="space-y-2">
            {profile.role === "district_admin" && (
              <Link
                href="/dashboard/schools/create"
                className="flex items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Building2 className="w-4 h-4" />
                Add School
              </Link>
            )}
            <Link
              href="/dashboard/users/invite"
              className="flex items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Invite User
            </Link>
          </div>
        </div>
      )}

      {/* District Logo and User info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
        {/* District Logo */}
        {profile.districts && (
          <div className="flex justify-center mb-4">
            <DistrictLogo
              districtId={profile.districts.id}
              districtName={profile.districts.name}
              size={96}
              className="rounded-lg"
            />
          </div>
        )}

        {/* User info without avatar */}
        <div className="mb-3">
          <p className="text-sm font-medium text-gray-900 truncate text-center">
            {profile.first_name} {profile.last_name}
          </p>
          <p className="text-xs text-gray-500 truncate text-center">
            {roleDisplayName}
          </p>
          {profile.schools?.name && (
            <p className="text-xs text-gray-400 truncate text-center">
              {profile.schools.name}
            </p>
          )}
        </div>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          {signingOut ? "Signing out..." : "Sign Out"}
        </button>
      </div>
    </div>
  );
}
