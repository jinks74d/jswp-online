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
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { UserProfile, UserRole } from "@/lib/supabase";

interface DashboardSidebarProps {
  profile: UserProfile & {
    districts?: { id: string; name: string; domain: string | null };
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
        {
          name: "Profile",
          href: "/dashboard/profile",
          icon: Settings,
          current: pathname.startsWith("/dashboard/profile"),
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
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      // Use router for navigation instead of hard redirect
      router.push("/");
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
    <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg">
      {/* Logo and District Info */}
      <div className="flex flex-col h-20 justify-center px-6 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-1">
          <img 
            src="/favicon.ico" 
            alt="JSWP Online" 
            className="w-8 h-8"
          />
          <span className="text-lg font-bold text-gray-900">JSWP Online</span>
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
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
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

      {/* User info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-blue-600">
              {profile.first_name?.[0] || profile.email[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {profile.first_name} {profile.last_name}
            </p>
            <p className="text-xs text-gray-500 truncate">{roleDisplayName}</p>
            {profile.schools?.name && (
              <p className="text-xs text-gray-400 truncate">
                {profile.schools.name}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          {signingOut ? "Signing out..." : "Sign Out"}
        </button>
      </div>
    </div>
  );
}
