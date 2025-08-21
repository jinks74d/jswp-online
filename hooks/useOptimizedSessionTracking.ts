// hooks/useOptimizedSessionTracking.ts
"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useAuth } from "@/components/auth/OptimizedAuthProvider";
import { usePathname } from "next/navigation";
import { debounce, throttle } from "lodash-es";

interface OptimizedSessionTrackingOptions {
  trackPageViews?: boolean;
  activityInterval?: number;
  idleTimeout?: number;
  trackActions?: boolean;
}

const defaultOptions: OptimizedSessionTrackingOptions = {
  trackPageViews: true,
  activityInterval: 60000, // Increased to 1 minute
  idleTimeout: 1800000, // 30 minutes
  trackActions: true,
};

// Request queue for batch processing
class ActivityQueue {
  private queue: any[] = [];
  private processing = false;
  private readonly batchSize = 10;
  private readonly flushInterval = 5000; // 5 seconds

  constructor() {
    // Auto-flush every 5 seconds
    setInterval(() => this.flush(), this.flushInterval);
  }

  add(activity: any) {
    this.queue.push(activity);
    
    // Flush if queue is getting full
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  private async flush() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    const batch = this.queue.splice(0, this.batchSize);
    
    try {
      await fetch("/api/analytics/session/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activities: batch }),
      });
    } catch (error) {
      console.warn("Failed to send activity batch:", error);
      // Re-queue failed items (up to a limit)
      if (batch.length < 50) {
        this.queue.unshift(...batch);
      }
    } finally {
      this.processing = false;
    }
  }
}

export function useOptimizedSessionTracking(
  options: OptimizedSessionTrackingOptions = {}
) {
  const { authState } = useAuth();
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);
  
  const config = useMemo(() => ({ ...defaultOptions, ...options }), [options]);
  
  // Refs for persistent state
  const sessionIdRef = useRef<string | null>(null);
  const lastActivityRef = useRef<Date>(new Date());
  const mountedRef = useRef(true);
  const activityQueueRef = useRef<ActivityQueue | null>(null);
  const cleanupFunctionsRef = useRef<(() => void)[]>([]);

  // Ensure client-side only
  useEffect(() => {
    setIsClient(true);
    activityQueueRef.current = new ActivityQueue();
  }, []);

  // Optimized activity tracking with batching
  const trackActivity = useCallback((activity: any) => {
    if (!sessionIdRef.current || !activityQueueRef.current) return;
    
    activityQueueRef.current.add({
      ...activity,
      sessionId: sessionIdRef.current,
      timestamp: new Date().toISOString(),
      path: pathname,
    });
    
    lastActivityRef.current = new Date();
  }, [pathname]);

  // Debounced activity handlers
  const debouncedTrackActivity = useMemo(
    () => debounce((type: string) => trackActivity({ type }), 1000),
    [trackActivity]
  );

  const throttledTrackActivity = useMemo(
    () => throttle((type: string) => trackActivity({ type }), 5000),
    [trackActivity]
  );

  // Optimized session management
  const startSession = useCallback(async () => {
    if (authState.status !== 'authenticated' || sessionIdRef.current) return;

    try {
      const response = await fetch("/api/analytics/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const { sessionId } = await response.json();
        sessionIdRef.current = sessionId;
        lastActivityRef.current = new Date();

        // Track initial page view
        if (config.trackPageViews) {
          trackActivity({ type: 'page_view', initial: true });
        }
      }
    } catch (error) {
      console.warn("Failed to start session:", error);
    }
  }, [authState.status, config.trackPageViews, trackActivity]);

  const endSession = useCallback(async () => {
    if (!sessionIdRef.current) return;

    const sessionId = sessionIdRef.current;
    sessionIdRef.current = null;

    try {
      // Use sendBeacon for reliability during page unload
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/analytics/session/end",
          JSON.stringify({ sessionId })
        );
      } else {
        await fetch("/api/analytics/session/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
      }
    } catch (error) {
      console.warn("Failed to end session:", error);
    }
  }, []);

  // Optimized event handlers with proper cleanup
  useEffect(() => {
    if (!isClient || authState.status !== 'authenticated') {
      return;
    }

    startSession();

    // Activity tracking with passive listeners
    const handleActivity = () => debouncedTrackActivity('user_activity');
    const handleScroll = () => throttledTrackActivity('scroll');
    const handleVisibilityChange = () => {
      if (document.hidden) {
        trackActivity({ type: 'page_hidden' });
      } else {
        trackActivity({ type: 'page_visible' });
      }
    };

    // Optimized event listener setup
    const events = [
      { type: 'click', handler: handleActivity, options: { passive: true } },
      { type: 'keydown', handler: handleActivity, options: { passive: true } },
      { type: 'scroll', handler: handleScroll, options: { passive: true } },
      { type: 'visibilitychange', handler: handleVisibilityChange, options: {} },
    ];

    events.forEach(({ type, handler, options }) => {
      if (type === 'visibilitychange') {
        document.addEventListener(type, handler, options);
      } else {
        window.addEventListener(type, handler, options);
      }
    });

    // Store cleanup functions
    cleanupFunctionsRef.current = events.map(({ type, handler }) => () => {
      if (type === 'visibilitychange') {
        document.removeEventListener(type, handler);
      } else {
        window.removeEventListener(type, handler);
      }
    });

    // Idle timeout
    const idleTimeout = setTimeout(() => {
      if (mountedRef.current) {
        endSession();
      }
    }, config.idleTimeout);

    return () => {
      // Cleanup event listeners
      cleanupFunctionsRef.current.forEach(cleanup => cleanup());
      clearTimeout(idleTimeout);
    };
  }, [
    isClient,
    authState.status,
    startSession,
    endSession,
    debouncedTrackActivity,
    throttledTrackActivity,
    trackActivity,
    config.idleTimeout,
  ]);

  // Page change tracking
  useEffect(() => {
    if (config.trackPageViews && sessionIdRef.current) {
      trackActivity({ type: 'page_view' });
    }
  }, [pathname, config.trackPageViews, trackActivity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      endSession();
      cleanupFunctionsRef.current.forEach(cleanup => cleanup());
    };
  }, [endSession]);

  // Public API
  return useMemo(() => ({
    trackAction: (actionType: string, actionDetails?: any) => {
      trackActivity({ type: 'action', actionType, actionDetails });
    },
    isTracking: !!sessionIdRef.current,
    sessionId: sessionIdRef.current,
  }), [trackActivity]);
}