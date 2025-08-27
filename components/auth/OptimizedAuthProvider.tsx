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
import { logger } from "@/lib/logger";
import { perf } from "@/lib/performance";

// Optimized state management with discriminated unions
type AuthState =
  | { status: "loading"; user: null; profile: null }
  | { status: "authenticated"; user: User; profile: UserProfile }
  | { status: "unauthenticated"; user: null; profile: null }
  | { status: "error"; user: null; profile: null; error: string };

interface AuthContextType {
  authState: AuthState;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Optimized component with proper memoization
export const OptimizedAuthProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [authState, setAuthState] = useState<AuthState>({
    status: "loading",
    user: null,
    profile: null,
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
  const fetchProfile = useCallback(
    async (
      userId: string,
      signal: AbortSignal
    ): Promise<UserProfile | null> => {
      try {
        // Check cache first
        const cachedProfile = AuthCache.getProfile();
        if (cachedProfile?.id === userId) {
          return cachedProfile;
        }

        if (!supabase) throw new Error("Supabase not initialized");

        const { data, error } = await supabase
          .from("user_profiles")
          .select(
            `
            *,
            districts:district_id(id, name, primary_color, secondary_color, logo_url),
            schools:school_id(id, name)
          `
          )
          .eq("id", userId)
          .abortSignal(signal)
          .single();

        if (error) throw error;
        if (!data) throw new Error("No profile data");

        // Cache successful result
        AuthCache.setProfile(data);
        return data as UserProfile;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return null; // Graceful abort
        }
        throw error;
      }
    },
    [supabase]
  );

  // Simplified auth change handler with proper state transitions
  const handleAuthChange = useCallback(
    async (event: AuthChangeEvent, session: Session | null) => {
      logger.authEvent(`Auth change: ${event}`, { hasSession: !!session });

      // Prevent concurrent auth processing
      if (authProcessingRef.current || !mountedRef.current) {
        logger.debug("Auth change skipped", {
          processing: authProcessingRef.current,
          mounted: mountedRef.current,
        });
        return;
      }

      authProcessingRef.current = true;
      if (perf) {
        perf.startTimer("auth-change-processing");
      }

      // Set timeout to force processing flag reset if something goes wrong
      const processingTimeout = setTimeout(() => {
        logger.warn("Auth processing timeout - forcing reset");
        authProcessingRef.current = false;
      }, 10000); // 10 second timeout

      try {
        // Cancel any existing operations
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const user = session?.user || null;
        logger.debug("Processing auth change", {
          userEmail: user?.email,
          event,
        });

        if (user) {
          try {
            logger.debug("Fetching profile for user", { userId: user.id });
            const profile = perf
              ? await perf.measureAsync("profile-fetch", () =>
                  fetchProfile(user.id, controller.signal)
                )
              : await fetchProfile(user.id, controller.signal);
            logger.authEvent("Profile fetched successfully", {
              role: profile?.role,
              email: profile?.email,
            });

            if (mountedRef.current && !controller.signal.aborted) {
              logger.authEvent("Setting authenticated state");
              setAuthState({
                status: "authenticated",
                user,
                profile: profile!,
              });

              // Set user ID in logger for future logs
              logger.setUserId(user.id);
            }
          } catch (error) {
            logger.error("Error fetching profile", {
              error: error instanceof Error ? error.message : "Unknown error",
              userId: user.id,
            });
            if (mountedRef.current && !controller.signal.aborted) {
              setAuthState({
                status: "error",
                user: null,
                profile: null,
                error: "Failed to load profile",
              });
            }
          }
        } else {
          logger.authEvent("No user found, setting unauthenticated state");
          if (mountedRef.current) {
            AuthCache.secureCleanup();
            logger.clearUserId();
            setAuthState({
              status: "unauthenticated",
              user: null,
              profile: null,
            });
          }
        }
      } finally {
        clearTimeout(processingTimeout);
        authProcessingRef.current = false;
        if (perf) {
          perf.endTimer("auth-change-processing");
        }
        logger.debug("Auth change processing completed");
      }
    },
    [fetchProfile]
  );

  // Optimized sign out with proper cleanup
  const signOut = useCallback(async () => {
    try {
      // Cancel ongoing operations
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Clear state immediately for better UX
      setAuthState({ status: "loading", user: null, profile: null });

      // Secure cleanup
      AuthCache.secureCleanup();

      // Sign out from Supabase
      if (supabase) {
        await supabase.auth.signOut({ scope: "global" });
      }

      // Redirect
      if (typeof window !== "undefined") {
        window.location.replace("/");
      }
    } catch (error) {
      console.error("Sign out error:", error);
      // Force cleanup and redirect even on error
      AuthCache.secureCleanup();
      if (typeof window !== "undefined") {
        window.location.replace("/");
      }
    }
  }, [supabase]);

  // Memoized refresh profile function
  const refreshProfile = useCallback(async () => {
    if (authState.status === "authenticated") {
      const controller = new AbortController();
      try {
        const profile = await fetchProfile(
          authState.user.id,
          controller.signal
        );
        if (profile && mountedRef.current) {
          setAuthState(
            (current) =>
              ({
                ...current,
                profile,
              } as AuthState)
          );
        }
      } catch (error) {
        console.warn("Profile refresh failed:", error);
      }
    }
  }, [authState, fetchProfile]);

  // Single effect for auth setup
  useEffect(() => {
    if (!supabase) return;

    // Initial session check with error handling and retry
    const initAuth = async () => {
      try {
        console.log("OptimizedAuthProvider: Checking initial session...");
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error(
            "OptimizedAuthProvider: Error getting initial session:",
            error
          );
          // Don't immediately set unauthenticated state on error - retry once
          setTimeout(async () => {
            try {
              const {
                data: { session: retrySession },
              } = await supabase.auth.getSession();
              console.log(
                "OptimizedAuthProvider: Retry session check:",
                !!retrySession,
                retrySession?.user?.email
              );
              if (mountedRef.current) {
                handleAuthChange("INITIAL_SESSION", retrySession);
              }
            } catch (retryError) {
              console.error("OptimizedAuthProvider: Retry failed:", retryError);
              if (mountedRef.current) {
                setAuthState({
                  status: "unauthenticated",
                  user: null,
                  profile: null,
                });
              }
            }
          }, 500);
        } else {
          console.log(
            "OptimizedAuthProvider: Initial session found:",
            !!session,
            session?.user?.email
          );
          if (session?.expires_at) {
            const expiresAt = new Date(session.expires_at * 1000);
            console.log(
              "OptimizedAuthProvider: Session expires at:",
              expiresAt
            );
          }

          if (mountedRef.current) {
            handleAuthChange("INITIAL_SESSION", session);
          }
        }
      } catch (error) {
        console.error(
          "OptimizedAuthProvider: Failed to get initial session:",
          error
        );
        if (mountedRef.current) {
          setAuthState({
            status: "unauthenticated",
            user: null,
            profile: null,
          });
        }
      }
    };

    // Set up auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(
        "OptimizedAuthProvider: Auth state changed:",
        event,
        !!session
      );
      handleAuthChange(event, session);
    });

    // Check initial session
    initAuth();

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
  const contextValue = useMemo(
    () => ({
      authState,
      signOut,
      refreshProfile,
    }),
    [authState, signOut, refreshProfile]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

// Optimized hook with proper error handling and backward compatibility
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an OptimizedAuthProvider");
  }

  // Provide backward-compatible interface
  const { authState, signOut, refreshProfile } = context;

  return {
    user: authState.status === "authenticated" ? authState.user : null,
    profile: authState.status === "authenticated" ? authState.profile : null,
    loading: authState.status === "loading",
    error: authState.status === "error" ? (authState as any).error : null,
    signOut,
    refreshProfile,
    // Also expose the raw authState for components that need it
    authState,
  };
}
