// components/analytics/SessionTrackingProvider.tsx
'use client';
import { createContext, useContext, ReactNode } from 'react';
import { useSessionTracking } from '@/hooks/useSessionTracking';

interface SessionTrackingContextType {
  trackAction: (actionType: string, actionDetails?: any, assignmentId?: string) => Promise<void>;
  updateActivity: () => void;
  isTracking: boolean;
  sessionId: string | null;
}

const SessionTrackingContext = createContext<SessionTrackingContextType | undefined>(undefined);

interface SessionTrackingProviderProps {
  children: ReactNode;
  options?: {
    trackPageViews?: boolean;
    activityInterval?: number;
    idleTimeout?: number;
    trackActions?: boolean;
  };
}

export function SessionTrackingProvider({ 
  children, 
  options = {} 
}: SessionTrackingProviderProps) {
  const sessionTracking = useSessionTracking(options);

  return (
    <SessionTrackingContext.Provider value={sessionTracking}>
      {children}
    </SessionTrackingContext.Provider>
  );
}

export function useSessionTrackingContext() {
  const context = useContext(SessionTrackingContext);
  if (context === undefined) {
    // Return a mock object instead of throwing error during SSR
    if (typeof window === 'undefined') {
      return {
        trackAction: async () => {},
        updateActivity: () => {},
        isTracking: false,
        sessionId: null,
      };
    }
    throw new Error('useSessionTrackingContext must be used within a SessionTrackingProvider');
  }
  return context;
}

// Higher-order component for easy integration
export function withSessionTracking<P extends object>(
  Component: React.ComponentType<P>
) {
  return function WrappedComponent(props: P) {
    return (
      <SessionTrackingProvider>
        <Component {...props} />
      </SessionTrackingProvider>
    );
  };
}