"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";

interface AuthEvent {
  timestamp: Date;
  event: string;
  details: any;
  type: "info" | "warning" | "error" | "success";
}

export function AuthMonitor() {
  const [events, setEvents] = useState<AuthEvent[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sessionHealth, setSessionHealth] = useState<
    "healthy" | "warning" | "error"
  >("healthy");
  const { user, profile, loading } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    // Optimized auth state monitoring
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      const newEvent: AuthEvent = {
        timestamp: new Date(),
        event: `Auth: ${event}`,
        details: {
          userId: session?.user?.id?.slice(0, 8) || "None",
          hasSession: !!session,
          expiresAt: session?.expires_at
            ? new Date(session.expires_at * 1000).toLocaleTimeString()
            : "N/A",
        },
        type:
          event === "SIGNED_OUT"
            ? "warning"
            : event === "SIGNED_IN"
            ? "success"
            : "info",
      };

      setEvents((prev) => [newEvent, ...prev].slice(0, 20)); // Reduced to 20 events

      // Optimized session health updates
      if (event === "SIGNED_OUT" || !session) {
        setSessionHealth("error");
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setSessionHealth("healthy");
      }
    });

    // Optimized health check - less frequent, more efficient
    const healthCheck = setInterval(async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          setSessionHealth("error");
        } else if (!session && user) {
          setSessionHealth("warning");
        } else if (session) {
          setSessionHealth("healthy");
        }
      } catch (error) {
        setSessionHealth("error");
      }
    }, 60000); // Check every 60 seconds

    return () => {
      subscription.unsubscribe();
      clearInterval(healthCheck);
    };
  }, [supabase.auth, user]);

  // Optimized provider state logging - only log significant changes
  useEffect(() => {
    if (!loading) {
      // Only log when not loading to reduce noise
      const event: AuthEvent = {
        timestamp: new Date(),
        event: "Provider State",
        details: {
          hasUser: !!user,
          userId: user?.id?.slice(0, 8) || "None",
          hasProfile: !!profile,
          role: profile?.role || "None",
        },
        type: user && profile ? "success" : "warning",
      };

      setEvents((prev) => [event, ...prev].slice(0, 20));
    }
  }, [user, profile, loading]);

  // Simplified window focus monitoring
  useEffect(() => {
    const handleFocus = async () => {
      if (user) {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error || !session) {
          setEvents((prev) =>
            [
              {
                timestamp: new Date(),
                event: "Focus Check",
                details: { status: "Session lost on focus" },
                type: "warning" as const,
              },
              ...prev,
            ].slice(0, 20)
          );
        }
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user, supabase.auth]);

  if (process.env.NODE_ENV === "production") {
    return null; // Don't show in production
  }

  const getHealthColor = () => {
    switch (sessionHealth) {
      case "healthy":
        return "bg-green-500";
      case "warning":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
    }
  };

  const getEventColor = (type: AuthEvent["type"]) => {
    switch (type) {
      case "success":
        return "text-green-600 bg-green-50";
      case "warning":
        return "text-yellow-600 bg-yellow-50";
      case "error":
        return "text-red-600 bg-red-50";
      default:
        return "text-blue-600 bg-blue-50";
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Collapsed view */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 hover:bg-gray-800 transition-colors"
        >
          <div className={`w-2 h-2 rounded-full ${getHealthColor()}`} />
          <span className="text-sm font-medium">Auth Monitor</span>
        </button>
      )}

      {/* Expanded view */}
      {isExpanded && (
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-96 max-h-[600px] overflow-hidden">
          {/* Header */}
          <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${getHealthColor()}`} />
              <h3 className="font-medium">Auth Monitor</h3>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Current State */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">User ID:</span>
                <span className="font-mono">{user?.id || "None"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Role:</span>
                <span className="font-mono">{profile?.role || "None"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Loading:</span>
                <span className="font-mono">{loading ? "Yes" : "No"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Session:</span>
                <span
                  className={`font-mono ${
                    sessionHealth === "healthy"
                      ? "text-green-600"
                      : sessionHealth === "warning"
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}
                >
                  {sessionHealth}
                </span>
              </div>
            </div>
          </div>

          {/* Events */}
          <div className="overflow-y-auto max-h-[400px]">
            {events.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                No auth events yet
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {events.map((event, index) => (
                  <div key={index} className="px-4 py-2 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-xs px-2 py-1 rounded-md inline-block ${getEventColor(
                            event.type
                          )}`}
                        >
                          {event.event}
                        </div>
                        {Object.keys(event.details).length > 0 && (
                          <div className="mt-1 text-xs text-gray-600 font-mono break-all">
                            {JSON.stringify(event.details, null, 2)}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 whitespace-nowrap">
                        {event.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
            <div className="flex gap-2">
              <button
                onClick={() => setEvents([])}
                className="text-xs px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 transition-colors"
              >
                Clear Events
              </button>
              <button
                onClick={async () => {
                  const {
                    data: { session },
                    error,
                  } = await supabase.auth.getSession();
                  setEvents((prev) =>
                    [
                      {
                        timestamp: new Date(),
                        event: "Manual Check",
                        details: {
                          hasSession: !!session,
                          error: error?.message,
                          userId: session?.user?.id?.slice(0, 8) || "None",
                        },
                        type: error ? ("error" as const) : ("success" as const),
                      },
                      ...prev,
                    ].slice(0, 20)
                  );
                }}
                className="text-xs px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
              >
                Check Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
