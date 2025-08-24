// components/dashboard/OptimizedDashboardSidebar.tsx
"use client";

import { useState, useCallback, useMemo, memo } from "react";
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
// import { useAuth } from "@/components/auth/OptimizedAuthProvider";
import { useAuth } from "@/app/dashboard/auth-provider";
import { UserProfile, UserRole } from "@/lib/supabase";
import DistrictLogo from "@/components/ui/DistrictLogo";
import { LoadingSpinner } from "@/components/ui/LoadingStates";

interface OptimizedDashboardSidebarProps {
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

// Memoized navigation item component
const NavigationItem = memo<{
  item: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    current: boolean;
  };
}>(({ item }) => {
  const Icon = item.icon;
  
  return (
    <Link
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
});

NavigationItem.displayName = 'NavigationItem';

// Memoized quick action component
const QuickAction = memo<{
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}>(({ href, icon: Icon, children }) => (
  <Link
    href={href}
    className="flex items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
  >
    <Icon className="w-4 h-4" />
    {children}
  </Link>
));

QuickAction.displayName = 'QuickAction';

// Navigation items based on user role - memoized and optimized
const getNavigationItems = (role: UserRole, pathname: string) => {
  const baseItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: Home,
      current: pathname === "/dashboard",
    },
  ];

  const roleSpecificItems = (() => {
    switch (role) {
      case "district_admin":
        return [
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
        return [];
    }
  })();

  return [...baseItems, ...roleSpecificItems];
};

// Role display names
const getRoleDisplayName = (role: UserRole): string => {
  const roleNames: Record<UserRole, string> = {
    super_admin: "Super Admin",
    district_admin: "District Admin",
    school_admin: "School Admin",
    teacher: "Teacher",
    student: "Student",
  };
  return roleNames[role] || "User";
};

export const OptimizedDashboardSidebar = memo<OptimizedDashboardSidebarProps>(({ profile }) => {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);
  const { signOut } = useAuth();

  // Memoized navigation items
  const navigation = useMemo(() => 
    getNavigationItems(profile.role, pathname), 
    [profile.role, pathname]
  );

  // Memoized role display name
  const roleDisplayName = useMemo(() => 
    getRoleDisplayName(profile.role), 
    [profile.role]
  );

  // Optimized sign out handler
  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
      setSigningOut(false);
    }
  }, [signOut, signingOut]);

  // Early return for loading state
  if (!profile) {
    return (
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-sidebar">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <LoadingSpinner size="md" className="mx-auto mb-4" />
            <p className="text-gray-600">Loading sidebar...</p>
          </div>
        </div>
      </div>
    );
  }

  // Memoized quick actions for admin roles
  const quickActions = useMemo(() => {
    if (profile.role !== "district_admin" && profile.role !== "school_admin") {
      return null;
    }

    return (
      <div className="mt-8 px-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Quick Actions
        </h3>
        <div className="space-y-2">
          {profile.role === "district_admin" && (
            <QuickAction href="/dashboard/schools/create" icon={Building2}>
              Add School
            </QuickAction>
          )}
          <QuickAction href="/dashboard/users/invite" icon={UserPlus}>
            Invite User
          </QuickAction>
        </div>
      </div>
    );
  }, [profile.role]);

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
        {navigation.map((item) => (
          <NavigationItem key={item.name} item={item} />
        ))}
      </nav>

      {/* Quick Actions */}
      {quickActions}

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

        {/* User info */}
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
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {signingOut ? (
            <LoadingSpinner size="sm" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          {signingOut ? "Signing out..." : "Sign Out"}
        </button>
      </div>
    </div>
  );
});

OptimizedDashboardSidebar.displayName = 'OptimizedDashboardSidebar';

export default OptimizedDashboardSidebar;