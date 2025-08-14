// hooks/useSessionTracking.ts
'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { usePathname } from 'next/navigation';
import { isLikelyRealPageUnload, onNavigationStart } from '@/lib/navigation-detection';

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

  // Main effect - setup and cleanup
  useEffect(() => {
    if (!isClient || !user || !profile) {
      // Only end session, don't trigger signout API if user/profile don't exist
      if (sessionIdRef.current) {
        // Just clear the session tracking, don't call signout API
        sessionIdRef.current = null;
        isTrackingRef.current = false;
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

    // Listen for beforeunload - only sign out on actual browser/tab close
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Only proceed if this appears to be a real page unload
      if (!isLikelyRealPageUnload()) {
        return;
      }
      
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

    // More reliable detection for actual page unloads using pagehide
    const handlePageHide = (event: PageTransitionEvent) => {
      // pagehide fires on actual navigation away from page
      // event.persisted indicates if page is being cached (back/forward navigation)
      if (!event.persisted && isLikelyRealPageUnload()) {
        // This is likely a real page unload, not navigation
        const signoutData = JSON.stringify({});
        
        try {
          if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/auth/signout', signoutData);
          }
        } catch (error) {
          console.warn('Error during pagehide signout:', error);
        }
        
        endSession();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    
    // Set up navigation detection
    const unsubscribeNavigation = onNavigationStart(() => {
      // Navigation started, this helps our detection logic
    });

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
      window.removeEventListener('pagehide', handlePageHide);
      
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
