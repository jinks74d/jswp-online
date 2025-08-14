// components/auth/AuthFlowMonitor.tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { createClient } from "@/lib/supabase";
import { AuthChangeEvent, Session } from "@supabase/supabase-js";

interface AuthEvent {
  timestamp: string;
  event: string;
  details: string;
  status: "info" | "success" | "warning" | "error";
}

export function AuthFlowMonitor() {
  const [events, setEvents] = useState<AuthEvent[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const { user, profile, loading } = useAuth();

  const addEvent = (event: string, details: string, status: AuthEvent["status"] = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    setEvents(prev => [...prev.slice(-9), { timestamp, event, details, status }]);
  };

  // Monitor auth state changes
  useEffect(() => {
    if (loading) {
      addEvent("Auth Loading", "Authentication state is being determined", "info");
    } else if (user && profile) {
      addEvent("Auth Success", `Logged in as ${profile.role} (${profile.email})`, "success");
    } else if (user && !profile) {
      addEvent("Profile Missing", "User authenticated but no profile found", "warning");
    } else {
      addEvent("Not Authenticated", "No user session found", "info");
    }
  }, [user, profile, loading]);

  // Monitor Supabase auth events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const supabase = createClient();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      switch (event) {
        case 'SIGNED_IN':
          addEvent("Supabase Event", `SIGNED_IN: ${session?.user?.email}`, "success");
          break;
        case 'SIGNED_OUT':
          addEvent("Supabase Event", "SIGNED_OUT", "info");
          break;
        case 'TOKEN_REFRESHED':
          addEvent("Supabase Event", "TOKEN_REFRESHED", "success");
          break;
        case 'USER_UPDATED':
          addEvent("Supabase Event", "USER_UPDATED", "info");
          break;
        case 'PASSWORD_RECOVERY':
          addEvent("Supabase Event", "PASSWORD_RECOVERY", "info");
          break;
        default:
          addEvent("Supabase Event", `${event}`, "info");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Monitor page navigation
  useEffect(() => {
    const handleNavigation = () => {
      addEvent("Navigation", `Page: ${window.location.pathname}`, "info");
    };

    handleNavigation(); // Log initial page
    window.addEventListener('popstate', handleNavigation);

    return () => {
      window.removeEventListener('popstate', handleNavigation);
    };
  }, []);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const getStatusColor = (status: AuthEvent["status"]) => {
    switch (status) {
      case "success": return "text-green-600 bg-green-50";
      case "warning": return "text-yellow-600 bg-yellow-50";
      case "error": return "text-red-600 bg-red-50";
      default: return "text-blue-600 bg-blue-50";
    }
  };

  const getStatusIcon = (status: AuthEvent["status"]) => {
    switch (status) {
      case "success": return "✓";
      case "warning": return "⚠";
      case "error": return "✕";
      default: return "ℹ";
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-md shadow-lg hover:bg-gray-700 transition-colors"
      >
        Auth Monitor {events.length > 0 && `(${events.length})`}
      </button>

      {/* Events Panel */}
      {isVisible && (
        <div className="w-96 max-h-96 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-900">Auth Flow Monitor</h3>
              <button
                onClick={() => setEvents([])}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
            <div className="text-xs text-gray-600 mt-1">
              User: {user ? "✓" : "✕"} | Profile: {profile ? "✓" : "✕"} | Loading: {loading ? "✓" : "✕"}
            </div>
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {events.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">
                No events yet
              </div>
            ) : (
              events.map((event, index) => (
                <div
                  key={index}
                  className={`px-4 py-2 border-b border-gray-100 last:border-b-0 ${getStatusColor(event.status)}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono mt-0.5">
                      {getStatusIcon(event.status)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs font-medium truncate">
                          {event.event}
                        </span>
                        <span className="text-xs text-gray-500 font-mono whitespace-nowrap">
                          {event.timestamp}
                        </span>
                      </div>
                      <div className="text-xs opacity-75 mt-1 break-words">
                        {event.details}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Quick Actions */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  addEvent("Manual Test", "Testing session check", "info");
                  const supabase = createClient();
                  supabase.auth.getSession().then(({ data, error }: any) => {
                    if (error) {
                      addEvent("Session Check", `Error: ${error.message}`, "error");
                    } else if (data.session) {
                      addEvent("Session Check", `Active session: ${data.session.user.email}`, "success");
                    } else {
                      addEvent("Session Check", "No active session", "warning");
                    }
                  });
                }}
                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                Test Session
              </button>
              <button
                onClick={() => {
                  addEvent("Manual Test", "Testing profile fetch", "info");
                  if (user) {
                    const supabase = createClient();
                    supabase.from("user_profiles").select("*").eq("id", user.id).single()
                      .then(({ data, error }: any) => {
                        if (error) {
                          addEvent("Profile Check", `Error: ${error.message}`, "error");
                        } else if (data) {
                          addEvent("Profile Check", `Profile found: ${data.email}`, "success");
                        } else {
                          addEvent("Profile Check", "No profile data", "warning");
                        }
                      });
                  } else {
                    addEvent("Profile Check", "No user to check profile for", "warning");
                  }
                }}
                className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
              >
                Test Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
