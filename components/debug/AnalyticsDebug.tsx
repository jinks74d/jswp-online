// components/debug/AnalyticsDebug.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSessionTrackingContext } from "@/components/analytics/SessionTrackingProvider";

export function AnalyticsDebug() {
  const { user, profile } = useAuth();
  const { isTracking, sessionId } = useSessionTrackingContext();
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchDebugData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/debug/analytics-school");
      if (response.ok) {
        const data = await response.json();
        setDebugData(data);
      } else {
        console.error("Failed to fetch debug data:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching debug data:", error);
    } finally {
      setLoading(false);
    }
  };

  const testSessionStart = async () => {
    try {
      const response = await fetch("/api/analytics/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();
      console.log("Session start result:", result);
      alert(
        `Session start: ${response.ok ? "Success" : "Failed"}\n${JSON.stringify(
          result,
          null,
          2
        )}`
      );
    } catch (error) {
      console.error("Session start error:", error);
      alert(`Session start error: ${error}`);
    }
  };

  const testAnalyticsAPI = async () => {
    try {
      const response = await fetch("/api/analytics/dashboard?range=7d");
      const result = await response.json();
      console.log("Analytics API result:", result);
      alert(
        `Analytics API: ${response.ok ? "Success" : "Failed"}\n${JSON.stringify(
          result.data?.summary || result.error,
          null,
          2
        )}`
      );
    } catch (error) {
      console.error("Analytics API error:", error);
      alert(`Analytics API error: ${error}`);
    }
  };

  const testAuth = async () => {
    try {
      // Check what's in sessionStorage
      const sessionData = sessionStorage.getItem("jswp-session");
      console.log("SessionStorage data:", sessionData);

      // Check cookies
      console.log("Document cookies:", document.cookie);

      const response = await fetch("/api/debug/auth-test");
      const result = await response.json();
      console.log("Auth test result:", result);
      alert(
        `Auth Test: ${response.ok ? "Success" : "Failed"}\n${JSON.stringify(
          result,
          null,
          2
        )}`
      );
    } catch (error) {
      console.error("Auth test error:", error);
      alert(`Auth test error: ${error}`);
    }
  };

  const testDashboardData = async () => {
    try {
      const response = await fetch("/api/debug/dashboard-data");
      const result = await response.json();
      console.log("Dashboard data result:", result);

      if (response.ok) {
        const summary = `Dashboard Data Summary:
• Role: ${result.profile?.role}
• Assignments: ${result.data?.assignments?.count || 0}
• Users: ${result.data?.users?.count || 0}
• Classes: ${result.data?.classes?.count || 0}
• Schools: ${result.data?.schools?.count || 0}`;
        alert(summary);
      } else {
        alert(
          `Dashboard Data Test Failed:\n${JSON.stringify(result, null, 2)}`
        );
      }
    } catch (error) {
      console.error("Dashboard data test error:", error);
      alert(`Dashboard data test error: ${error}`);
    }
  };

  const testTeachersData = async () => {
    try {
      const response = await fetch("/api/debug/teachers-data");
      const result = await response.json();
      console.log("Teachers data result:", result);

      if (response.ok) {
        const summary = `Teachers Data Debug:
• Your Role: ${result.currentUser?.role}
• Your School: ${result.currentUser?.school_name || "None"}
• All Teachers: ${result.queries?.allTeachers?.count || 0}
• District Teachers: ${result.queries?.districtTeachers?.count || 0}
• School Teachers: ${result.queries?.schoolTeachers?.count || 0}
• Page Query Result: ${result.queries?.pageQuery?.count || 0}

Role Breakdown: ${JSON.stringify(
          result.queries?.allRoles?.breakdown || {},
          null,
          2
        )}`;
        alert(summary);
      } else {
        alert(`Teachers Data Test Failed:\n${JSON.stringify(result, null, 2)}`);
      }
    } catch (error) {
      console.error("Teachers data test error:", error);
      alert(`Teachers data test error: ${error}`);
    }
  };

  const inspectDatabase = async () => {
    try {
      const response = await fetch("/api/debug/database-inspection");
      const result = await response.json();
      console.log("Database inspection result:", result);

      if (response.ok) {
        const db = result.database;
        const summary = `Database Inspection:
📊 TOTAL USERS: ${db.allUsers?.count || 0}
📋 ROLE BREAKDOWN: ${JSON.stringify(db.allUsers?.roleBreakdown || {}, null, 2)}
🏫 SCHOOLS: ${db.schools?.count || 0}
🏛️ DISTRICTS: ${db.districts?.count || 0}
📝 ASSIGNMENTS: ${db.assignments?.count || 0}

🔍 UNIQUE ROLES FOUND: ${JSON.stringify(
          db.roleVariations?.uniqueRoles || [],
          null,
          2
        )}

📍 YOUR SCHOOL ID: ${result.currentUser?.school_id}
📍 YOUR DISTRICT ID: ${result.currentUser?.district_id}

🗂️ TABLES EXIST: ${JSON.stringify(db.tableExistence?.tables || [], null, 2)}`;

        alert(summary);

        // Also log detailed data for inspection
        console.log("Sample users:", db.allUsers?.sample);
        console.log("District breakdown:", db.allUsers?.districtBreakdown);
        console.log("School breakdown:", db.allUsers?.schoolBreakdown);
      } else {
        alert(
          `Database Inspection Failed:\n${JSON.stringify(result, null, 2)}`
        );
      }
    } catch (error) {
      console.error("Database inspection error:", error);
      alert(`Database inspection error: ${error}`);
    }
  };

  const testConnection = async () => {
    try {
      const response = await fetch("/api/debug/connection-test");
      const result = await response.json();
      console.log("Connection test result:", result);

      if (response.ok) {
        const conn = result.connection;
        const summary = `Connection Test:
🔗 Supabase URL: ${conn.supabaseUrl}
🔑 Has API Key: ${conn.hasKey ? "Yes" : "No"}
📊 Test Query: ${conn.testQuery.success ? "Success" : "Failed"}
👤 Auth Status: ${conn.auth.hasUser ? "Authenticated" : "Not authenticated"}
🆔 User ID: ${conn.auth.userId || "None"}

${conn.testQuery.error ? "Query Error: " + conn.testQuery.error : ""}
${conn.auth.error ? "Auth Error: " + conn.auth.error : ""}`;

        alert(summary);
      } else {
        alert(`Connection Test Failed:\n${JSON.stringify(result, null, 2)}`);
      }
    } catch (error) {
      console.error("Connection test error:", error);
      alert(`Connection test error: ${error}`);
    }
  };

  useEffect(() => {
    fetchDebugData();
  }, []);

  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className="bg-white border border-gray-300 rounded-lg shadow-lg">
        {/* Minimized Header */}
        <div
          className="flex items-center justify-between p-2 cursor-pointer hover:bg-gray-50"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isTracking ? "bg-green-500" : "bg-red-500"
              }`}
            ></div>
            <span className="text-xs font-medium text-gray-700">Debug</span>
            <span className="text-xs text-gray-500">
              ({profile?.role || "none"})
            </span>
          </div>
          <div className="text-xs text-gray-400">{isExpanded ? "−" : "+"}</div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t border-gray-200 p-3 max-w-sm">
            {/* Quick Status */}
            <div className="space-y-1 mb-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">User:</span>
                <span className="text-gray-900 truncate ml-2">
                  {user?.email?.split("@")[0] || "None"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Role:</span>
                <span className="text-gray-900">{profile?.role || "None"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tracking:</span>
                <span
                  className={isTracking ? "text-green-600" : "text-red-600"}
                >
                  {isTracking ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            {/* Compact Action Buttons */}
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={testConnection}
                className="text-xs px-2 py-1 bg-cyan-100 text-cyan-700 rounded hover:bg-cyan-200"
              >
                Connection
              </button>
              <button
                onClick={testAuth}
                className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
              >
                Auth
              </button>
              <button
                onClick={testDashboardData}
                className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
              >
                Dashboard
              </button>
              <button
                onClick={testTeachersData}
                className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                Teachers
              </button>
              <button
                onClick={inspectDatabase}
                className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
              >
                Database
              </button>
              <button
                onClick={testAnalyticsAPI}
                className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
              >
                Analytics
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
