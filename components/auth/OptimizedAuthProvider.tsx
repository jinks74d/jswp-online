// components/auth/OptimizedAuthProvider.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  ReactNode,
} from "react";
import { User, AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { UserProfile } from "@/lib/supabase";
import { AuthCache } from "@/lib/auth-cache";

// Optimized state management with discriminated unions
type AuthState = 
  | { status: 'loading'; user: null; profile: null }
  | { status: 'authenticated'; user: User; profile: UserProfile }
  | { status: 'unauthenticated'; user: null; profile: null }
  | { status: 'error'; user: null; profile: null; error: string };

interface AuthContextType {
  authState: AuthState;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Optimized component with proper memoization
export const OptimizedAuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>({ 
    status: 'loading', 
    user: null, 
    profile: null 
  });
  
  // Single abort controller for all async operations
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const authProcessingRef = useRef(false);
  
  // Memoized supabase client
  const supabase = useMemo(() => {
    if (typeof window !== "undefined") {
      return createClient();
    }
    return null;
  }, []);

  // Optimized profile fetching with better error handling
  const fetchProfile = useCallback(async (userId: string, signal: AbortSignal): Promise<UserProfile | null> => {
    try {
      // Check cache first
      const cachedProfile = AuthCache.getProfile();
      if (cachedProfile?.id === userId) {
        return cachedProfile;
      }

      if (!supabase) throw new Error('Supabase not initialized');

      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .abortSignal(signal)
        .single();

      if (error) throw error;
      if (!data) throw new Error('No profile data');

      // Cache successful result
      AuthCache.setProfile(data);
      return data as UserProfile;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return null; // Graceful abort
      }
      throw error;
    }
  }, [supabase]);

  // Simplified auth change handler with proper state transitions
  const handleAuthChange = useCallback(async (
    event: AuthChangeEvent, 
    session: Session | null
  ) => {
    // Prevent concurrent auth processing
    if (authProcessingRef.current || !mountedRef.current) return;
    
    authProcessingRef.current = true;
    
    try {
      // Cancel any existing operations
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const user = session?.user || null;

      if (user) {
        try {
          const profile = await fetchProfile(user.id, controller.signal);
          
          if (mountedRef.current && !controller.signal.aborted) {
            setAuthState({
              status: 'authenticated',
              user,
              profile: profile!
            });
          }
        } catch (error) {
          if (mountedRef.current && !controller.signal.aborted) {
            setAuthState({
              status: 'error',
              user: null,
              profile: null,
              error: 'Failed to load profile'
            });
          }
        }
      } else {
        if (mountedRef.current) {
          AuthCache.secureCleanup();
          setAuthState({
            status: 'unauthenticated',
            user: null,
            profile: null
          });
        }
      }
    } finally {
      authProcessingRef.current = false;
    }
  }, [fetchProfile]);

  // Optimized sign out with proper cleanup
  const signOut = useCallback(async () => {
    try {
      // Cancel ongoing operations
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Clear state immediately for better UX
      setAuthState({ status: 'loading', user: null, profile: null });
      
      // Secure cleanup
      AuthCache.secureCleanup();
      
      // Sign out from Supabase
      if (supabase) {
        await supabase.auth.signOut({ scope: 'global' });
      }

      // Redirect
      if (typeof window !== "undefined") {
        window.location.replace("/");
      }
    } catch (error) {
      console.error('Sign out error:', error);
      // Force cleanup and redirect even on error
      AuthCache.secureCleanup();
      if (typeof window !== "undefined") {
        window.location.replace("/");
      }
    }
  }, [supabase]);

  // Memoized refresh profile function
  const refreshProfile = useCallback(async () => {
    if (authState.status === 'authenticated') {
      const controller = new AbortController();
      try {
        const profile = await fetchProfile(authState.user.id, controller.signal);
        if (profile && mountedRef.current) {
          setAuthState(current => ({
            ...current,
            profile
          }));
        }
      } catch (error) {
        console.warn('Profile refresh failed:', error);
      }
    }
  }, [authState, fetchProfile]);

  // Single effect for auth setup
  useEffect(() => {
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);
    
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mountedRef.current) {
        handleAuthChange('INITIAL_SESSION', session);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, handleAuthChange]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    authState,
    signOut,
    refreshProfile,
  }), [authState, signOut, refreshProfile]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Optimized hook with proper error handling
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an OptimizedAuthProvider");
  }
  return context;
}