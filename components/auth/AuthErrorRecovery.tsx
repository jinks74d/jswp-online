"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";

interface RecoveryAttempt {
  timestamp: Date;
  type: "session_refresh" | "storage_clear" | "full_reset";
  success: boolean;
  error?: string;
}

export function AuthErrorRecovery() {
  const [recoveryAttempts, setRecoveryAttempts] = useState<RecoveryAttempt[]>(
    []
  );
  const [isRecovering, setIsRecovering] = useState(false);
  const { user, loading } = useAuth();
  const supabase = createClient();

  // Auto-recovery for common auth issues
  const attemptRecovery = useCallback(
    async (type: RecoveryAttempt["type"]) => {
      if (isRecovering) return false;

      setIsRecovering(true);
      const attempt: RecoveryAttempt = {
        timestamp: new Date(),
        type,
        success: false,
      };

      try {
        switch (type) {
          case "session_refresh":
            const { error: refreshError } =
              await supabase.auth.refreshSession();
            if (!refreshError) {
              attempt.success = true;
            } else {
              attempt.error = refreshError.message;
            }
            break;

          case "storage_clear":
            if (typeof window !== "undefined") {
              // Clear only auth-related storage
              const keysToRemove = [];
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.includes("auth") || key.includes("supabase"))) {
                  keysToRemove.push(key);
                }
              }
              keysToRemove.forEach((key) => localStorage.removeItem(key));
              attempt.success = true;
            }
            break;

          case "full_reset":
            await supabase.auth.signOut({ scope: "global" });
            if (typeof window !== "undefined") {
              localStorage.clear();
              sessionStorage.clear();
              // Force page reload to reset all state
              window.location.reload();
            }
            attempt.success = true;
            break;
        }
      } catch (error: any) {
        attempt.error = error.message;
      }

      setRecoveryAttempts((prev) => [attempt, ...prev].slice(0, 10));
      setIsRecovering(false);
      return attempt.success;
    },
    [isRecovering, supabase.auth]
  );

  // Monitor for stuck authentication states
  useEffect(() => {
    if (loading && user === null) {
      // If loading for more than 10 seconds without user, attempt recovery
      const timeoutId = setTimeout(() => {
        console.warn("Auth loading timeout detected, attempting recovery");
        attemptRecovery("session_refresh");
      }, 10000);

      return () => clearTimeout(timeoutId);
    }
  }, [loading, user, attemptRecovery]);

  // Monitor for session errors
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      if (event === "SIGNED_OUT" && session === null && user !== null) {
        // Unexpected sign out - attempt recovery
        console.warn("Unexpected sign out detected, attempting recovery");
        setTimeout(() => attemptRecovery("session_refresh"), 1000);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth, user, attemptRecovery]);

  // Monitor window focus for session validation
  useEffect(() => {
    const handleFocus = async () => {
      if (user) {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error || !session) {
          console.warn("Session lost on focus, attempting recovery");
          attemptRecovery("session_refresh");
        }
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user, supabase.auth, attemptRecovery]);

  // Don't render in production unless there are critical issues
  if (process.env.NODE_ENV === "production" && recoveryAttempts.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 z-40">
      {isRecovering && (
        <div className="bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 mb-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm">Recovering authentication...</span>
        </div>
      )}

      {recoveryAttempts.length > 0 &&
        process.env.NODE_ENV === "development" && (
          <div className="bg-gray-900 text-white p-2 rounded-lg shadow-lg max-w-xs">
            <div className="text-xs font-medium mb-1">Auth Recovery Log</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {recoveryAttempts.slice(0, 5).map((attempt, index) => (
                <div
                  key={index}
                  className={`text-xs p-1 rounded ${
                    attempt.success ? "bg-green-800" : "bg-red-800"
                  }`}
                >
                  <div className="flex justify-between">
                    <span>{attempt.type}</span>
                    <span>{attempt.success ? "✓" : "✗"}</span>
                  </div>
                  {attempt.error && (
                    <div className="text-red-300 truncate">{attempt.error}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Manual recovery buttons */}
            <div className="flex gap-1 mt-2">
              <button
                onClick={() => attemptRecovery("session_refresh")}
                disabled={isRecovering}
                className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
              >
                Refresh
              </button>
              <button
                onClick={() => attemptRecovery("storage_clear")}
                disabled={isRecovering}
                className="text-xs px-2 py-1 bg-orange-600 hover:bg-orange-700 rounded disabled:opacity-50"
              >
                Clear
              </button>
              <button
                onClick={() => attemptRecovery("full_reset")}
                disabled={isRecovering}
                className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
              >
                Reset
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
