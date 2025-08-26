// components/super-admin/SuperAdminSidebar.tsx
"use client";

import { useState } from "react";
import { Building2, Users, Settings, LogOut, Home, BarChart3 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/OptimizedAuthProvider";
import { UserProfile } from "@/lib/supabase";

interface SuperAdminSidebarProps {
  profile: UserProfile;
}

export default function SuperAdminSidebar({ profile }: SuperAdminSidebarProps) {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      // AuthProvider will handle the redirect with full page refresh
      // Set a timeout as a fallback in case redirect doesn't work
      setTimeout(() => {
        setSigningOut(false);
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }, 3000); // 3 second fallback
    } catch (error) {
      console.error("Error signing out:", error);
      // Show user-friendly error message
      alert("Failed to sign out. Please try again.");
      setSigningOut(false);
    }
  };

  const navigation = [
    {
      name: "Dashboard",
      href: "/super-admin",
      icon: Home,
      current: pathname === "/super-admin",
    },
    {
      name: "Districts",
      href: "/super-admin/districts",
      icon: Building2,
      current: pathname.startsWith("/super-admin/districts"),
    },
    {
      name: "Users",
      href: "/super-admin/users",
      icon: Users,
      current: pathname.startsWith("/super-admin/users"),
    },
    {
      name: "Analytics",
      href: "/super-admin/analytics",
      icon: BarChart3,
      current: pathname.startsWith("/super-admin/analytics"),
    },
    {
      name: "Settings",
      href: "/super-admin/settings",
      icon: Settings,
      current: pathname.startsWith("/super-admin/settings"),
    },
  ];

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b border-gray-200">
        <div className="flex items-center justify-center">
          <img 
            src="/assets/jswp-logo.svg" 
            alt="JSWP Online" 
            className="w-full h-full max-w-none max-h-12"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-8 px-4 space-y-2">
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

      {/* User info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-blue-600">
              {profile.first_name?.[0] || "S"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {profile.first_name} {profile.last_name}
            </p>
            <p className="text-xs text-gray-500 truncate">Super Admin</p>
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
