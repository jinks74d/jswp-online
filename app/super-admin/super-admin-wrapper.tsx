// app/super-admin/super-admin-wrapper.tsx
"use client";

import { AuthProvider } from "../dashboard/auth-provider";
import type { AuthSession } from "@/lib/auth/types";

interface SuperAdminWrapperProps {
  session: AuthSession;
  children: React.ReactNode;
}

export function SuperAdminWrapper({ session, children }: SuperAdminWrapperProps) {
  return (
    <AuthProvider initialSession={session}>
      <div className="min-h-screen bg-gray-50">
        <div className="flex">
          {/* Sidebar */}
          <div className="w-64 bg-white shadow-sm">
            <div className="p-4">
              <h1 className="text-xl font-bold text-gray-900">JSWP Admin</h1>
              <p className="text-sm text-gray-500 mt-1">
                {session.profile.first_name || session.profile.email}
              </p>
              <p className="text-xs text-gray-400">Super Administrator</p>
            </div>
            
            {/* Navigation */}
            <nav className="mt-8">
              <div className="px-4 space-y-2">
                <a
                  href="/super-admin"
                  className="flex items-center px-2 py-2 text-sm font-medium text-gray-900 rounded-md hover:bg-gray-100"
                >
                  Overview
                </a>
                <a
                  href="/super-admin/districts"
                  className="flex items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100"
                >
                  Districts
                </a>
                <a
                  href="/super-admin/users"
                  className="flex items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100"
                >
                  Users
                </a>
                <a
                  href="/super-admin/analytics"
                  className="flex items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100"
                >
                  Analytics
                </a>
                <a
                  href="/super-admin/settings"
                  className="flex items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100"
                >
                  Settings
                </a>
              </div>
            </nav>

            {/* Sign out button */}
            <div className="absolute bottom-4 left-4 right-4">
              <button
                onClick={async () => {
                  const response = await fetch("/api/auth/signout", {
                    method: "POST",
                    credentials: "include",
                  });
                  if (response.ok) {
                    window.location.href = "/login";
                  }
                }}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1">
            <main className="p-8">
              {children}
            </main>
          </div>
        </div>
      </div>
    </AuthProvider>
  );
}