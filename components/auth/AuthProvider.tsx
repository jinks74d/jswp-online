// components/auth/AuthProvider.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { User, AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { UserProfile } from "@/lib/supabase";
import { NetworkRecoveryModal } from "./NetworkRecoveryModal";
import { SessionWarningModal } from "./SessionWarningModal";
import { AuthCache } from "@/lib/auth-cache";
import { SessionSecurity } from "@/lib/session-security";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNetworkRecovery, setShowNetworkRecovery] = useState(false);
  const [showSessionWarning, setShowSessionWarning] = useState(false);

  // Refs for cleanup and state management
  const mountedRef = useRef(true);
  const authProcessingRef = useRef(false);
  const profileFetchRef = useRef<AbortController | null>(null);
  const timeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const sessionSecurityRef = useRef<SessionSecurity | null>(null);
  const lastAuthEventRef = useRef<Map<string, number>>(new Map());

  // PERFORMANCE: Create client once and reuse with better SSR handling
  const supabase = useMemo(() => {
    if (typeof window !== "undefined") {
      return createClient();
    }
    return null;
  }, []);

  // FIXED: Reliable profile fetching with timeout and error handling
  const fetchProfile = useCallback(
    async (userId: string): Promise<UserProfile | null> => {
      if (!userId || !mountedRef.current || !supabase) {
        return null;
      }

      // Cancel any existing profile fetch
      if (profileFetchRef.current) {
        profileFetchRef.current.abort();
      }

      // Create new abort controller for this fetch
      const abortController = new AbortController();
      profileFetchRef.current = abortController;

      try {
        // Check cache first with improved validation
        const cachedProfile = AuthCache.getProfile();
        if (
          cachedProfile &&
          cachedProfile.id === userId &&
          mountedRef.current
        ) {
          return cachedProfile;
        }

        // PERFORMANCE: Optimized profile fetch with selective fields and shorter timeout
        const fetchPromise = supabase
          .from("user_profiles")
          .select(
            "id, role, district_id, school_id, first_name, last_name, email, created_at, updated_at, districts:district_id(id, name, domain, primary_color, secondary_color, logo_url), schools:school_id(id, name)"
          )
          .eq("id", userId)
          .abortSignal(abortController.signal)
          .maybeSingle(); // Use maybeSingle to avoid errors on missing records

        const timeoutPromise = new Promise(
          (_, reject) =>
            setTimeout(() => reject(new Error("Database query timeout")), 3000) // Reduced from 5000ms
        );

        const result = await Promise.race([fetchPromise, timeoutPromise]);
        const { data, error } = result as any;

        if (abortController.signal.aborted || !mountedRef.current) {
          return null;
        }

        if (error) {
          console.warn("AuthProvider: Profile fetch error:", error);
          return null;
        }

        if (!data) {
          console.warn("AuthProvider: No profile data returned");
          return null;
        }

        // Cache the profile
        AuthCache.setProfile(data);
        return data as UserProfile;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.log("AuthProvider: Profile fetch aborted");
          return null;
        }
        console.warn("AuthProvider: Profile fetch failed:", error);
        return null;
      }
    },
    [supabase]
  );

  // Cleanup utility
  const cleanup = useCallback(() => {
    // Cancel any ongoing profile fetch
    if (profileFetchRef.current) {
      profileFetchRef.current.abort();
      profileFetchRef.current = null;
    }

    // Clear all timeouts
    timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    timeoutsRef.current.clear();

    // Close broadcast channel
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.close();
      broadcastChannelRef.current = null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user && mountedRef.current) {
      const profileData = await fetchProfile(user.id);
      if (mountedRef.current) {
        setProfile(profileData);
      }
    }
  }, [user, fetchProfile]);

  // FIXED: Simplified auth change handler with better timeout management
  const handleAuthChange = useCallback(
    async (event: AuthChangeEvent, session: Session | null) => {
      if (!mountedRef.current || authProcessingRef.current) {
        return;
      }

      // Debounce rapid auth change events (especially SIGNED_IN events)
      const now = Date.now();
      const lastEventKey = `${event}_${!!session?.user}`;
      const lastEventTime = lastAuthEventRef.current.get(lastEventKey) || 0;

      if (now - lastEventTime < 1000) {
        // 1 second debounce
        return;
      }

      lastAuthEventRef.current.set(lastEventKey, now);
      authProcessingRef.current = true;

      try {
        const currentUser = session?.user || null;
        setUser(currentUser);

        if (currentUser) {
          // Cache session
          if (session) {
            AuthCache.setSession(session);
          }

          // PERFORMANCE: Optimized profile fetch with reduced timeout and better error handling
          let profileData: UserProfile | null = null;
          try {
            const profilePromise = fetchProfile(currentUser.id);
            const timeoutPromise = new Promise<UserProfile | null>(
              (_, reject) =>
                setTimeout(
                  () => reject(new Error("Profile fetch timeout")),
                  2000
                ) // Reduced from 3000ms
            );

            profileData = await Promise.race([profilePromise, timeoutPromise]);
          } catch (error) {
            console.warn(
              "AuthProvider: Profile fetch failed, using cache:",
              error
            );
            profileData = AuthCache.getProfile();

            // If no cached profile, try a quick fallback fetch
            if (!profileData && currentUser.id && supabase) {
              try {
                const fallbackProfile = await supabase
                  .from("user_profiles")
                  .select("id, role, district_id, email")
                  .eq("id", currentUser.id)
                  .maybeSingle()
                  .then((res: any) => res.data);
                profileData = fallbackProfile;
              } catch (fallbackError) {
                console.warn("AuthProvider: Fallback profile fetch failed");
              }
            }
          }

          if (mountedRef.current) {
            setProfile(profileData);
            // Update auth state cache for quick access
            if (profileData) {
              AuthCache.setAuthState({
                hasUser: true,
                hasProfile: true,
                userEmail: profileData.email,
                userRole: profileData.role,
              });
            }
          }
        } else {
          // Clear state for unauthenticated user
          AuthCache.secureCleanup();
          setProfile(null);

          // Clean up session security
          if (sessionSecurityRef.current) {
            sessionSecurityRef.current.cleanup();
            sessionSecurityRef.current = null;
          }
        }

        // FIXED: Always set loading to false at the end
        if (mountedRef.current) {
          setLoading(false);
        }
      } catch (error) {
        console.error("AuthProvider: Error in auth change handler:", error);

        if (mountedRef.current) {
          setLoading(false);
          // Use cached profile as fallback on error
          const cachedProfile = AuthCache.getProfile();
          if (cachedProfile && !profile) {
            setProfile(cachedProfile);
          }
        }
      } finally {
        // FIXED: Always clear processing flag
        authProcessingRef.current = false;
      }
    },
    [fetchProfile, profile, supabase]
  );

  // Simplified network error handling
  const handleNetworkError = useCallback(() => {
    // Show recovery modal after shorter grace period (30 seconds)
    const timeout = setTimeout(() => {
      if (mountedRef.current) {
        setShowNetworkRecovery(true);
      }
    }, 30000);

    timeoutsRef.current.add(timeout);
  }, []);

  // Simplified initialization
  useEffect(() => {
    if (!supabase) {
      return;
    }

    // Setting up auth listeners

    // Set up cross-tab communication
    if (typeof window !== "undefined" && window.BroadcastChannel) {
      broadcastChannelRef.current = new BroadcastChannel("jswp-auth");

      const handleBroadcastMessage = (event: MessageEvent) => {
        if (!mountedRef.current) return;

        if (event.data.type === "LOGOUT_ALL_TABS") {
          setUser(null);
          setProfile(null);
          setLoading(false);
          if (typeof window !== "undefined") {
            window.location.replace("/");
          }
        } else if (event.data.type === "EXTEND_SESSION") {
          setShowNetworkRecovery(false);
        }
      };

      broadcastChannelRef.current.addEventListener(
        "message",
        handleBroadcastMessage
      );
    }

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(handleAuthChange);

    // Optimized initial session check with cache
    const checkInitialSession = async () => {
      try {
        // Quick check for cached auth state first
        const cachedAuthState = AuthCache.getAuthState();
        if (
          cachedAuthState &&
          cachedAuthState.hasUser &&
          cachedAuthState.hasProfile
        ) {
          // We have cached auth data, but still need to verify session
        }

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.warn("AuthProvider: Session error:", error.message);
          if (
            error.message?.includes("network") ||
            error.message?.includes("fetch")
          ) {
            handleNetworkError();
          } else if (mountedRef.current) {
            setLoading(false);
          }
          return;
        }

        if (mountedRef.current) {
          await handleAuthChange(
            session ? "INITIAL_SESSION" : "SIGNED_OUT",
            session
          );
        }
      } catch (error) {
        console.error("AuthProvider: Initial session check failed:", error);
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    checkInitialSession();

    // FIXED: Removed competing safety timeout - let auth change handler complete
    return () => {
      subscription.unsubscribe();
      cleanup();
    };
  }, [supabase, handleAuthChange, handleNetworkError, cleanup]);

  // Enhanced sign out function with security measures
  const signOut = useCallback(async () => {
    try {
      // Broadcast security logout to all tabs
      if (sessionSecurityRef.current) {
        sessionSecurityRef.current.broadcastSecurityLogout();
      }

      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            type: "LOGOUT_ALL_TABS",
            timestamp: Date.now(),
          });
        } catch (error) {
          console.warn("AuthProvider: Failed to broadcast logout:", error);
        }
      }

      // Clear state immediately
      setUser(null);
      setProfile(null);
      setLoading(false);
      setShowSessionWarning(false);
      setShowNetworkRecovery(false);

      // Secure cache cleanup
      AuthCache.secureCleanup();

      // Clean up session security
      if (sessionSecurityRef.current) {
        sessionSecurityRef.current.cleanup();
        sessionSecurityRef.current = null;
      }

      // Sign out from Supabase with timeout
      if (supabase) {
        const signOutPromise = supabase.auth.signOut({ scope: "global" });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Sign out timeout")), 5000)
        );

        try {
          await Promise.race([signOutPromise, timeoutPromise]);
        } catch (error) {
          console.warn(
            "AuthProvider: Sign out timeout, proceeding with redirect"
          );
        }
      }

      // Force redirect to login
      if (typeof window !== "undefined") {
        window.location.replace("/");
      }
    } catch (error) {
      console.error("AuthProvider: Error during secure sign out:", error);
      // Ensure cleanup even on error
      AuthCache.secureCleanup();
      if (sessionSecurityRef.current) {
        sessionSecurityRef.current.cleanup();
        sessionSecurityRef.current = null;
      }
      // Force redirect even on error
      if (typeof window !== "undefined") {
        window.location.replace("/");
      }
    }
  }, [supabase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cleanup();

      // Clean up session security
      if (sessionSecurityRef.current) {
        sessionSecurityRef.current.cleanup();
        sessionSecurityRef.current = null;
      }

      // Destroy session security singleton
      SessionSecurity.destroy();
    };
  }, [cleanup]);

  // FIXED: Single fallback timeout for initial load
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading && mountedRef.current && !authProcessingRef.current) {
        setLoading(false);
      }
    }, 8000); // Increased to 8 seconds to allow auth change handler to complete

    timeoutsRef.current.add(timeout);
    return () => clearTimeout(timeout);
  }, []); // Empty dependency array to run only once

  // Simplified network recovery handlers
  const handleExtendSession = useCallback(async () => {
    try {
      setShowNetworkRecovery(false);

      // Broadcast session extension
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({
          type: "EXTEND_SESSION",
          timestamp: Date.now(),
        });
      }

      // Verify session is still valid
      if (supabase) {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error || !session) {
          await signOut();
        }
      }
    } catch (error) {
      console.error("AuthProvider: Error extending session:", error);
      await signOut();
    }
  }, [supabase, signOut]);

  const handleCloseNetworkRecovery = useCallback(() => {
    setShowNetworkRecovery(false);
  }, []);

  // Session warning handlers
  const handleExtendSessionWarning = useCallback(() => {
    setShowSessionWarning(false);
    if (sessionSecurityRef.current) {
      sessionSecurityRef.current.extendSession();
    }
  }, []);

  const handleSessionWarningSignOut = useCallback(() => {
    setShowSessionWarning(false);
    signOut();
  }, [signOut]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
      <NetworkRecoveryModal
        isOpen={showNetworkRecovery}
        onExtendSession={handleExtendSession}
        onSignOut={signOut}
        onClose={handleCloseNetworkRecovery}
      />
      <SessionWarningModal
        isOpen={showSessionWarning}
        onExtendSession={handleExtendSessionWarning}
        onSignOut={handleSessionWarningSignOut}
        onClose={() => setShowSessionWarning(false)}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
