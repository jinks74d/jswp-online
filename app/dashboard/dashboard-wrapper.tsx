// app/dashboard/dashboard-wrapper.tsx
"use client";

import { AuthProvider } from "./auth-provider";
import type { AuthSession } from "@/lib/auth/types";

interface DashboardWrapperProps {
  session: AuthSession;
  children: React.ReactNode;
}

export function DashboardWrapper({ session, children }: DashboardWrapperProps) {
  return (
    <AuthProvider initialSession={session}>
      <div className="min-h-screen bg-gray-50">
        <div className="flex">
          {/* Sidebar */}
          <div className="w-64 bg-white shadow-sm">
            <div className="p-4">
              <h1 className="text-xl font-bold text-gray-900">JSWP Online</h1>
              <p className="text-sm text-gray-500 mt-1">
                {session.profile.first_name || session.profile.email}
              </p>
              <p className="text-xs text-gray-400">
                {session.profile.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </p>
            </div>
            
            {/* Navigation */}
            <nav className="mt-8">
              <div className="px-4 space-y-2">
                <a
                  href="/dashboard"
                  className="flex items-center px-2 py-2 text-sm font-medium text-gray-900 rounded-md hover:bg-gray-100"
                >
                  Dashboard
                </a>
                <a
                  href="/dashboard/assignments"
                  className="flex items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100"
                >
                  Assignments
                </a>
                <a
                  href="/dashboard/classes"
                  className="flex items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100"
                >
                  Classes
                </a>
                {(session.profile.role === "district_admin" || session.profile.role === "school_admin") && (
                  <a
                    href="/dashboard/users"
                    className="flex items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100"
                  >
                    Users
                  </a>
                )}
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