// hooks/useSessionTracking.ts
"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "@/components/auth/OptimizedAuthProvider";
import { usePathname } from "next/navigation";
import { AsyncHandler } from "@/lib/async-handler";
import { AppError, ErrorType, classifyError } from "@/lib/errors";
import {
  isLikelyRealPageUnload,
  onNavigationStart,
} from "@/lib/navigation-detection";

interface SessionTrackingOptions {
  trackPageViews?: boolean;
  activityInterval?: number; // milliseconds
  idleTimeout?: number; // milliseconds
  trackActions?: boolean;
}

const defaultOptions: SessionTrackingOptions = {
  trackPageViews: true,
  activityInterval: 30000, // 30 seconds
  idleTimeout: 1800000, // 30 minutes
  trackActions: true,
};

export function useSessionTracking(options: SessionTrackingOptions = {}) {
  const { user, profile } = useAuth();
  const pathname = usePathname();
  const sessionIdRef = useRef<string | null>(null);
  const lastActivityRef = useRef<Date>(new Date());
  const activityIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pageStartTimeRef = useRef<Date>(new Date());
  const isTrackingRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  const timeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const [isClient, setIsClient] = useState(false);

  const config = { ...defaultOptions, ...options };

  // Ensure this only runs on the client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Track user actions
  const trackAction = useCallback(
    async (actionType: string, actionDetails?: any, assignmentId?: string) => {
      if (!sessionIdRef.current || !config.trackActions) return;

      try {
        await fetch("/api/analytics/session/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            actionType,
            actionDetails,
            assignmentId,
            path: pathname,
          }),
        });
      } catch (error) {
        console.warn("Failed to track action:", error);
      }
    },
    [pathname, config.trackActions]
  );

  // Optimized activity tracking with batching
  const updateActivity = useCallback(
    async (trackPageView = false) => {
      if (!sessionIdRef.current || !mountedRef.current) return;

      const now = new Date();
      lastActivityRef.current = now;

      // Batch activity updates to reduce API calls
      try {
        const body: any = {
          sessionId: sessionIdRef.current,
          timestamp: now.toISOString(),
        };

        if (trackPageView && config.trackPageViews) {
          body.path = pathname;
          body.pageTitle = document.title;
        }

        // Use fire-and-forget approach for better performance
        fetch("/api/analytics/session/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        }).catch((error) => {
          console.warn("Failed to update activity:", error);
        });
      } catch (error) {
        console.warn("Failed to prepare activity update:", error);
      }
    },
    [pathname, config.trackPageViews]
  );

  // Start a new session
  const startSession = useCallback(async () => {
    if (!user || !profile || isTrackingRef.current) return;

    const result = await AsyncHandler.execute(
      async () => {
        const response = await fetch("/api/analytics/session/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new AppError({
            type:
              response.status === 401
                ? ErrorType.AUTHENTICATION_FAILED
                : response.status === 503
                ? ErrorType.TABLE_NOT_FOUND
                : ErrorType.API_REQUEST_FAILED,
            message:
              errorData.details ||
              `Session start failed with status ${response.status}`,
            context: {
              userId: user.id,
              metadata: {
                status: response.status,
                errorData,
              },
            },
          });
        }

        const data = await response.json();
        return data;
      },
      {
        operationName: "startSession",
        timeout: 10000,
        retries: 1,
        silent: true, // Don't log errors for analytics - it's not critical
        context: { userId: user.id },
        onError: (error) => {
          if (error.type === ErrorType.TABLE_NOT_FOUND) {
            console.warn(
              "Analytics tables not set up - session tracking disabled"
            );
          } else if (error.type === ErrorType.AUTHENTICATION_FAILED) {
            console.warn("Authentication issue - session tracking disabled");
          } else {
            console.warn("Session tracking unavailable:", error.userMessage);
          }
        },
      }
    );

    if (result.success && result.data) {
      sessionIdRef.current = result.data.sessionId;
      isTrackingRef.current = true;
      lastActivityRef.current = new Date();
      pageStartTimeRef.current = new Date();

      // Track initial page view
      if (config.trackPageViews) {
        setTimeout(() => updateActivity(true), 1000);
      }
    }
  }, [user, profile, config.trackPageViews, updateActivity]);

  // End the session
  const endSession = useCallback(async () => {
    if (!sessionIdRef.current) return;

    try {
      await fetch("/api/analytics/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      });
    } catch (error) {
      console.warn("Failed to end session:", error);
    } finally {
      sessionIdRef.current = null;
      isTrackingRef.current = false;
    }
  }, []);

  // Cleanup utility
  const cleanup = useCallback(() => {
    // Clear all intervals and timeouts
    if (activityIntervalRef.current) {
      clearInterval(activityIntervalRef.current);
      activityIntervalRef.current = null;
    }
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }

    // Clear all tracked timeouts
    timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    timeoutsRef.current.clear();
  }, []);

  // Handle user activity (clicks, keyboard, etc.)
  const handleUserActivity = useCallback(() => {
    if (!mountedRef.current) return;

    const now = new Date();
    lastActivityRef.current = now;

    // Reset idle timeout
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }

    const timeout = setTimeout(() => {
      if (mountedRef.current) {
        endSession();
      }
    }, config.idleTimeout);

    idleTimeoutRef.current = timeout;
    timeoutsRef.current.add(timeout);
  }, [endSession, config.idleTimeout]);

  // Sign out user completely (ends session and clears auth)
  const signOutUser = useCallback(async () => {
    try {
      // End session first
      await endSession();

      // Then sign out via API (this will clear auth cookies)
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
    } catch (error) {
      console.warn("Error during signout:", error);
    }
  }, [endSession]);

  // Handle page visibility changes (only pause/resume session tracking, don't logout)
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      // Page is now hidden, pause activity tracking but don't sign out
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
        activityIntervalRef.current = null;
      }
    } else if (user && profile && sessionIdRef.current) {
      // Page is visible again, resume activity tracking
      if (!activityIntervalRef.current) {
        activityIntervalRef.current = setInterval(() => {
          if (sessionIdRef.current) {
            updateActivity();
          }
        }, config.activityInterval);
      }
    }
  }, [user, profile, updateActivity, config.activityInterval]);

  // Track page changes
  useEffect(() => {
    if (!sessionIdRef.current || !config.trackPageViews) return;

    const pageEndTime = new Date();
    const timeOnPreviousPage = Math.round(
      (pageEndTime.getTime() - pageStartTimeRef.current.getTime()) / 1000
    );

    // Only track if user spent more than 3 seconds on the page
    if (timeOnPreviousPage > 3) {
      updateActivity(true);
    }

    pageStartTimeRef.current = new Date();
  }, [pathname, config.trackPageViews, updateActivity]);

  // Main effect - setup and cleanup with proper memory management
  useEffect(() => {
    if (!isClient || !user || !profile) {
      if (sessionIdRef.current) {
        sessionIdRef.current = null;
        isTrackingRef.current = false;
      }
      return;
    }

    // Start session
    startSession();

    // Set up activity tracking interval
    const activityInterval = setInterval(() => {
      if (sessionIdRef.current && mountedRef.current) {
        updateActivity();
      }
    }, config.activityInterval);
    activityIntervalRef.current = activityInterval;

    // Set up idle timeout
    const idleTimeout = setTimeout(() => {
      if (mountedRef.current) {
        endSession();
      }
    }, config.idleTimeout);
    idleTimeoutRef.current = idleTimeout;
    timeoutsRef.current.add(idleTimeout);

    // Set up event listeners for user activity
    const activityEvents = [
      "click",
      "keydown",
      "scroll",
      "mousemove",
      "touchstart",
    ];

    activityEvents.forEach((event) => {
      document.addEventListener(event, handleUserActivity, { passive: true });
    });

    // Listen for page visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Simplified page unload handling
    const handleBeforeUnload = () => {
      if (isLikelyRealPageUnload()) {
        try {
          if (navigator.sendBeacon) {
            navigator.sendBeacon("/api/auth/signout", "{}");
          }
        } catch (error) {
          console.warn("Error during signout:", error);
        }
        endSession();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Set up navigation detection
    const unsubscribeNavigation = onNavigationStart(() => {
      // Navigation started
    });

    // Cleanup function
    return () => {
      mountedRef.current = false;

      // Clean up all resources
      cleanup();

      // Remove event listeners
      activityEvents.forEach((event) => {
        document.removeEventListener(event, handleUserActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      // Clean up navigation detection
      unsubscribeNavigation();

      // End session
      endSession();
    };
  }, [
    isClient,
    user,
    profile,
    startSession,
    endSession,
    updateActivity,
    handleUserActivity,
    handleVisibilityChange,
    cleanup,
    config.activityInterval,
    config.idleTimeout,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  // Return tracking functions for manual use
  return {
    trackAction,
    updateActivity: () => updateActivity(false),
    isTracking: isTrackingRef.current,
    sessionId: sessionIdRef.current,
  };
}
