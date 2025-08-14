// app/super-admin/settings/page.tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";

export default async function SuperAdminSettingsPage() {
  const cookieStore = await cookies();
  const supabase = await createServerSupabaseClient(cookieStore);

  // Get current user and verify super admin permissions
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/");
  }

  // Get user profile to verify super admin role
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "super_admin") {
    redirect("/");
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600 mt-1">
            Configure global system preferences and settings
          </p>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* General Settings */}
        <div className="bg-white rounded-lg shadow-sm border-2 border-[#0B2559] p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            General Settings
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                System Name
              </label>
              <input
                type="text"
                defaultValue="JSWP Online"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">
                This setting requires database migration to modify
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default User Role
              </label>
              <select
                defaultValue="student"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="school_admin">School Admin</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Future enhancement - role assignment automation
              </p>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white rounded-lg shadow-sm border-2 border-[#0B2559] p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Security Settings
          </h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled
                />
                <span className="text-sm text-gray-700">
                  Require email verification for new accounts
                </span>
              </label>
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled
                />
                <span className="text-sm text-gray-700">
                  Enable two-factor authentication
                </span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Timeout (minutes)
              </label>
              <input
                type="number"
                defaultValue="480"
                min="30"
                max="1440"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">
                Currently managed by Supabase auth settings
              </p>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white rounded-lg shadow-sm border-2 border-[#0B2559] p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Notification Settings
          </h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled
                />
                <span className="text-sm text-gray-700">
                  Send welcome emails to new users
                </span>
              </label>
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled
                />
                <span className="text-sm text-gray-700">
                  Email notifications for system updates
                </span>
              </label>
            </div>
            <p className="text-xs text-gray-500">
              Email notification system is planned for future release
            </p>
          </div>
        </div>

        {/* System Information */}
        <div className="bg-white rounded-lg shadow-sm border-2 border-[#0B2559] p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            System Information
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Version</span>
              <span className="text-sm font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Environment</span>
              <span className="text-sm font-medium">
                {process.env.NODE_ENV || "development"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Database</span>
              <span className="text-sm font-medium">Supabase PostgreSQL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Last Updated</span>
              <span className="text-sm font-medium">
                {new Date().toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <button
          className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          disabled
        >
          Reset to Defaults
        </button>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          disabled
        >
          Save Settings
        </button>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> This settings page is a placeholder for future functionality. 
          Most system settings are currently managed through environment variables and database configuration.
        </p>
      </div>
    </div>
  );
}