// hooks/useSessionTracking.ts
'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { usePathname } from 'next/navigation';

interface SessionTrackingOptions {
  trackPageViews?: boolean;
  activityInterval?: number; // milliseconds
  idleTimeout?: number; // milliseconds
  trackActions?: boolean;
}

const defaultOptions: SessionTrackingOptions = {
  trackPageViews: true,
  activityInterval: 30000, // 30 seconds
  idleTimeout: 900000, // 15 minutes
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
  const [isClient, setIsClient] = useState(false);

  const config = { ...defaultOptions, ...options };

  // Ensure this only runs on the client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Track user actions
  const trackAction = useCallback(async (
    actionType: string, 
    actionDetails?: any, 
    assignmentId?: string
  ) => {
    if (!sessionIdRef.current || !config.trackActions) return;

    try {
      await fetch('/api/analytics/session/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          actionType,
          actionDetails,
          assignmentId,
          path: pathname,
        }),
      });
    } catch (error) {
      console.warn('Failed to track action:', error);
    }
  }, [pathname, config.trackActions]);

  // Update activity timestamp
  const updateActivity = useCallback(async (trackPageView = false) => {
    if (!sessionIdRef.current) return;

    const now = new Date();
    lastActivityRef.current = now;

    try {
      const body: any = {
        sessionId: sessionIdRef.current,
      };

      if (trackPageView && config.trackPageViews) {
        body.path = pathname;
        body.pageTitle = document.title;
      }

      await fetch('/api/analytics/session/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (error) {
      console.warn('Failed to update activity:', error);
    }
  }, [pathname, config.trackPageViews]);

  // Start a new session
  const startSession = useCallback(async () => {
    if (!user || !profile || isTrackingRef.current) return;

    try {
      const response = await fetch('/api/analytics/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const { sessionId } = await response.json();
        sessionIdRef.current = sessionId;
        isTrackingRef.current = true;
        lastActivityRef.current = new Date();
        pageStartTimeRef.current = new Date();

        // Track initial page view
        if (config.trackPageViews) {
          setTimeout(() => updateActivity(true), 1000);
        }
      }
    } catch (error) {
      console.warn('Failed to start session:', error);
    }
  }, [user, profile, config.trackPageViews, updateActivity]);

  // End the session
  const endSession = useCallback(async () => {
    if (!sessionIdRef.current) return;

    try {
      await fetch('/api/analytics/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      });
    } catch (error) {
      console.warn('Failed to end session:', error);
    } finally {
      sessionIdRef.current = null;
      isTrackingRef.current = false;
    }
  }, []);

  // Handle user activity (clicks, keyboard, etc.)
  const handleUserActivity = useCallback(() => {
    const now = new Date();
    lastActivityRef.current = now;

    // Reset idle timeout
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }

    idleTimeoutRef.current = setTimeout(() => {
      // End session due to inactivity
      endSession();
    }, config.idleTimeout);
  }, [endSession, config.idleTimeout]);

  // Sign out user completely (ends session and clears auth)
  const signOutUser = useCallback(async () => {
    try {
      // End session first
      await endSession();
      
      // Then sign out via API (this will clear auth cookies)
      await fetch('/api/auth/signout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.warn('Error during signout:', error);
    }
  }, [endSession]);

  // Handle page visibility changes
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      // Page is now hidden, sign out user completely
      signOutUser();
    } else if (user && profile && !sessionIdRef.current) {
      // Page is visible again, start new session
      startSession();
    }
  }, [user, profile, signOutUser, startSession]);

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

  // Main effect - setup and cleanup
  useEffect(() => {
    if (!isClient || !user || !profile) {
      if (sessionIdRef.current) {
        endSession();
      }
      return;
    }

    // Start session
    startSession();

    // Set up activity tracking interval
    activityIntervalRef.current = setInterval(() => {
      if (sessionIdRef.current) {
        updateActivity();
      }
    }, config.activityInterval);

    // Set up idle timeout
    idleTimeoutRef.current = setTimeout(() => {
      endSession();
    }, config.idleTimeout);

    // Set up event listeners for user activity
    const activityEvents = ['click', 'keydown', 'scroll', 'mousemove', 'touchstart'];
    
    activityEvents.forEach(event => {
      document.addEventListener(event, handleUserActivity, { passive: true });
    });

    // Listen for page visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen for beforeunload to sign out user
    const handleBeforeUnload = () => {
      // Use navigator.sendBeacon for reliable signout during page unload
      const signoutData = JSON.stringify({});
      
      try {
        // Try sendBeacon first (most reliable for page unload)
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/auth/signout', signoutData);
        } else {
          // Fallback to synchronous fetch
          fetch('/api/auth/signout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: signoutData,
            keepalive: true
          });
        }
      } catch (error) {
        console.warn('Error during browser close signout:', error);
      }
      
      // Also end session
      endSession();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      // Clear intervals and timeouts
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
      }
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }

      // Remove event listeners
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleUserActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);

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
    signOutUser,
    config.activityInterval,
    config.idleTimeout
  ]);

  // Return tracking functions for manual use
  return {
    trackAction,
    updateActivity: () => updateActivity(false),
    isTracking: isTrackingRef.current,
    sessionId: sessionIdRef.current,
  };
}