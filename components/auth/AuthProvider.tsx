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
import { AuthCache } from "@/lib/auth-cache";

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
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [showNetworkRecovery, setShowNetworkRecovery] = useState(false);
  const mountedRef = useRef(true);
  const authProcessingRef = useRef(false);
  const networkGracePeriodRef = useRef<NodeJS.Timeout | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Create client once and reuse - only on client side
  const supabase = useMemo(() => {
    if (typeof window !== "undefined") {
      console.log("AuthProvider: Creating Supabase client");
      return createClient();
    }
    return null;
  }, []);

  const fetchProfile = useCallback(
    async (userId: string): Promise<UserProfile | null> => {
      if (!userId || !mountedRef.current || !supabase) {
        console.log("AuthProvider: fetchProfile early return:", {
          userId: !!userId,
          mounted: mountedRef.current,
          supabase: !!supabase,
        });
        return null;
      }

      // Check cache first for faster loading
      const cachedProfile = AuthCache.getProfile();
      if (cachedProfile && cachedProfile.id === userId) {
        console.log("AuthProvider: Using cached profile for user:", userId);
        return cachedProfile;
      }

      // Retry logic for profile fetch
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(
            `AuthProvider: Fetching profile for user (attempt ${attempt}):`,
            userId
          );

          // First verify we have a valid session before querying
          console.log(`AuthProvider: Getting session for attempt ${attempt}`);

          // Add timeout to getSession call
          const sessionPromise = supabase.auth.getSession();
          const sessionTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("getSession timeout")), 3000)
          );

          const sessionResult = await Promise.race([
            sessionPromise,
            sessionTimeout,
          ]);
          console.log(`AuthProvider: Session result:`, sessionResult);

          const {
            data: { session },
            error: sessionError,
          } = sessionResult;
          if (sessionError) {
            console.warn(
              `AuthProvider: Session error before profile fetch:`,
              sessionError
            );
            return null;
          }

          if (!session || !session.user) {
            console.warn(`AuthProvider: No valid session for profile fetch`);
            return null;
          }

          console.log(
            `AuthProvider: Session confirmed, proceeding with profile query for:`,
            session.user.email
          );

          // Add a small delay to ensure session is fully propagated
          console.log(`AuthProvider: Waiting 500ms for session propagation`);
          await new Promise((resolve) => setTimeout(resolve, 500));

          console.log(
            `AuthProvider: Starting database query for user:`,
            userId
          );

          // Simplified profile query with timeout to prevent hanging
          const profilePromise = supabase
            .from("user_profiles")
            .select("*")
            .eq("id", userId)
            .single();

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Profile fetch timeout")), 2000)
          );

          console.log(
            `AuthProvider: Executing Promise.race for database query`
          );
          const result = await Promise.race([profilePromise, timeoutPromise]);
          console.log(`AuthProvider: Promise.race completed:`, result);

          const { data, error } = result as any;

          // Log the actual error for debugging
          if (error) {
            console.error(
              `AuthProvider: Database error (attempt ${attempt}):`,
              error
            );
          }

          if (error) {
            console.warn(
              `AuthProvider: Profile fetch error (attempt ${attempt}):`,
              error
            );

            // If it's a timeout or connection error and we have more attempts, try again
            if (
              attempt === 1 &&
              (error.message.includes("timeout") || error.code === "PGRST301")
            ) {
              console.log(
                "AuthProvider: Retrying profile fetch after connection error..."
              );
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }

            return null;
          }

          if (!data) {
            console.warn("AuthProvider: No profile data returned");
            return null;
          }

          console.log(
            "AuthProvider: Profile fetched successfully:",
            data.email
          );
          console.log("AuthProvider: Profile data:", {
            role: data.role,
            email: data.email,
            id: data.id,
          });

          // Cache the profile for faster subsequent loads
          AuthCache.setProfile(data);

          return data as UserProfile;
        } catch (error) {
          console.warn(
            `AuthProvider: Error in fetchProfile attempt ${attempt}:`,
            error
          );

          // If this was the first attempt and it was a timeout, try again
          if (
            attempt === 1 &&
            error instanceof Error &&
            error.message.includes("timeout")
          ) {
            console.log(
              "AuthProvider: Retrying profile fetch after timeout..."
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }

          // If this was the last attempt or a non-timeout error, give up
          return null;
        }
      }

      return null;
    },
    [supabase]
  );

  const refreshProfile = useCallback(async () => {
    if (user && mountedRef.current) {
      const profileData = await fetchProfile(user.id);
      if (mountedRef.current) {
        setProfile(profileData);
      }
    }
  }, [user, fetchProfile]);

  // Optimized auth change handler - skip profile fetch for SIGNED_IN events
  const handleAuthChange = useCallback(
    async (event: AuthChangeEvent, session: Session | null) => {
      console.log("AuthProvider: handleAuthChange ENTRY:", {
        mounted: mountedRef.current,
        processing: authProcessingRef.current,
        event,
        userEmail: session?.user?.email,
      });

      if (!mountedRef.current || authProcessingRef.current) {
        console.log("AuthProvider: handleAuthChange EARLY RETURN:", {
          mounted: mountedRef.current,
          processing: authProcessingRef.current,
        });
        return;
      }

      authProcessingRef.current = true;

      try {
        console.log(
          "AuthProvider: Auth state changed:",
          event,
          session?.user?.email
        );

        const currentUser = session?.user || null;
        setUser(currentUser);

        // Cache session if we have one
        if (session) {
          AuthCache.setSession(session);
        }

        if (currentUser) {
          // Always fetch profile for any authenticated user regardless of event type
          console.log(
            "AuthProvider: Fetching profile for event:",
            event,
            "User ID:",
            currentUser.id
          );
          console.log("AuthProvider: About to call fetchProfile...");
          const profileData = await fetchProfile(currentUser.id);
          console.log(
            "AuthProvider: fetchProfile returned:",
            profileData ? "DATA" : "NULL"
          );
          if (mountedRef.current) {
            console.log(
              "AuthProvider: Setting profile state:",
              profileData ? "SUCCESS" : "NULL"
            );
            setProfile(profileData);
            console.log("AuthProvider: Profile state updated");
          }
        } else {
          // Before clearing profile, check if this might be a temporary network issue
          console.log(
            "AuthProvider: No user found, checking for session recovery..."
          );

          // Only attempt session recovery if we're not on the login page
          const isOnLoginPage =
            typeof window !== "undefined" &&
            (window.location.pathname === "/" ||
              window.location.pathname === "/admin");
          const cachedProfile = AuthCache.getProfile();
          const cachedSession = AuthCache.getSession();

          if (
            cachedProfile &&
            cachedSession &&
            event === "INITIAL_SESSION" &&
            !isOnLoginPage
          ) {
            console.log(
              "AuthProvider: Attempting session recovery from cache..."
            );

            // Try to refresh the session
            try {
              const { data: refreshData, error: refreshError } =
                await supabase.auth.refreshSession();

              if (!refreshError && refreshData.session) {
                console.log("AuthProvider: Session recovery successful");
                // Don't clear the profile yet, let the refreshed session trigger a new auth event
                return;
              } else {
                console.log(
                  "AuthProvider: Session recovery failed:",
                  refreshError?.message
                );
              }
            } catch (error) {
              console.log(
                "AuthProvider: Session recovery attempt failed:",
                error
              );
            }
          }

          // Clear profile and cache for unauthenticated user
          console.log("AuthProvider: Clearing profile for signed out user");
          AuthCache.clearAll();
          setProfile(null);
        }

        if (mountedRef.current) {
          setLoading(false);
          setInitialLoadComplete(true);
          console.log(
            "AuthProvider: Set loading to false and initialLoadComplete to true"
          );
        }
      } catch (error) {
        console.error("AuthProvider: Error in auth change handler:", error);

        // Don't clear user state on errors during auth changes
        // This prevents unexpected sign-outs due to network issues
        if (mountedRef.current) {
          setLoading(false);
          setInitialLoadComplete(true);

          // If we had a user before this error, don't clear them
          // Let the cached profile serve as a fallback
          const cachedProfile = AuthCache.getProfile();
          if (cachedProfile && !profile) {
            console.log("AuthProvider: Using cached profile after auth error");
            setProfile(cachedProfile);
          }
        }
      } finally {
        authProcessingRef.current = false;
        console.log("AuthProvider: handleAuthChange COMPLETE");
      }
    },
    [fetchProfile]
  );

  // Handle network errors with grace period
  const handleNetworkError = useCallback(() => {
    console.log(
      "AuthProvider: Handling network error with 5-minute grace period"
    );
    setNetworkError(true);

    // Clear existing grace period
    if (networkGracePeriodRef.current) {
      clearTimeout(networkGracePeriodRef.current);
    }

    // Set 5-minute grace period
    networkGracePeriodRef.current = setTimeout(() => {
      console.log(
        "AuthProvider: Network grace period expired, showing recovery options"
      );
      setShowNetworkRecovery(true);
    }, 5 * 60 * 1000); // 5 minutes
  }, []);

  // Initialize authentication
  useEffect(() => {
    if (!supabase) {
      console.log("AuthProvider: No Supabase client (SSR context)");
      return;
    }

    console.log("AuthProvider: Setting up auth listeners");

    let mounted = true;

    // Set up cross-tab communication
    if (typeof window !== "undefined" && window.BroadcastChannel) {
      broadcastChannelRef.current = new BroadcastChannel("jswp-auth");

      broadcastChannelRef.current.addEventListener("message", (event) => {
        if (!mounted) return;

        console.log("AuthProvider: Received broadcast message:", event.data);

        if (event.data.type === "LOGOUT_ALL_TABS") {
          console.log("AuthProvider: Logging out due to cross-tab logout");
          // Clear local state immediately
          setUser(null);
          setProfile(null);
          setLoading(false);
          // Redirect to login
          if (typeof window !== "undefined") {
            window.location.replace("/");
          }
        } else if (event.data.type === "EXTEND_SESSION") {
          console.log("AuthProvider: Session extended in another tab");
          // Reset any network error states
          setNetworkError(false);
          setShowNetworkRecovery(false);
          if (networkGracePeriodRef.current) {
            clearTimeout(networkGracePeriodRef.current);
            networkGracePeriodRef.current = null;
          }
        }
      });
    }

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(handleAuthChange);

    // Add visibility change handler to refresh session when user returns
    const handleVisibilityChange = () => {
      if (!document.hidden && user && supabase) {
        // Page became visible - check if session is still valid
        console.log(
          "AuthProvider: Page became visible, checking session validity"
        );

        supabase.auth.getSession().then(({ data: { session }, error }: any) => {
          if (error) {
            console.log(
              "AuthProvider: Session check error after visibility change:",
              error
            );
          } else if (!session && user) {
            console.log(
              "AuthProvider: No session found but user exists, attempting refresh"
            );
            supabase.auth
              .refreshSession()
              .then(({ data, error: refreshError }: any) => {
                if (refreshError) {
                  console.log(
                    "AuthProvider: Session refresh failed:",
                    refreshError
                  );
                } else {
                  console.log("AuthProvider: Session refreshed successfully");
                }
              });
          }
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Check initial session with fast timeout
    const checkInitialSession = async () => {
      try {
        console.log("AuthProvider: Checking initial session");

        // Add 3-second timeout to initial session check
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Initial session check timeout")),
            3000
          )
        );

        const sessionResult = await Promise.race([
          sessionPromise,
          timeoutPromise,
        ]);
        const {
          data: { session },
          error,
        } = sessionResult as any;

        if (error) {
          // More robust error logging to avoid console issues
          if (process.env.NODE_ENV === "development") {
            console.log("AuthProvider: Session error:", {
              message: error.message || "Unknown error",
              code: error.code || "No code",
              name: error.name || "Unknown",
            });
          }

          // Check if this is a network error
          if (
            error.message?.includes("fetch") ||
            error.message?.includes("network") ||
            error.message?.includes("timeout")
          ) {
            console.log(
              "AuthProvider: Network error detected, starting grace period"
            );
            handleNetworkError();
          } else {
            if (mounted) {
              setLoading(false);
              setInitialLoadComplete(true);
            }
          }
        } else if (mounted) {
          // Check if we have cached auth data before treating as signed out (but not on login pages)
          const isOnLoginPage =
            typeof window !== "undefined" &&
            (window.location.pathname === "/" ||
              window.location.pathname === "/admin");
          const cachedProfile = AuthCache.getProfile();
          const cachedSession = AuthCache.getSession();

          if (!session && cachedProfile && cachedSession && !isOnLoginPage) {
            console.log(
              "AuthProvider: No session found but have cached data, attempting refresh"
            );

            try {
              const { data: refreshData, error: refreshError } =
                await supabase.auth.refreshSession();

              if (!refreshError && refreshData.session) {
                console.log(
                  "AuthProvider: Session refresh successful during initial load"
                );
                await handleAuthChange("INITIAL_SESSION", refreshData.session);
              } else {
                console.log(
                  "AuthProvider: Session refresh failed during initial load"
                );
                await handleAuthChange("SIGNED_OUT", null);
              }
            } catch (refreshError) {
              console.log(
                "AuthProvider: Session refresh error during initial load:",
                refreshError
              );
              await handleAuthChange("SIGNED_OUT", null);
            }
          } else {
            // Use INITIAL_SESSION event for initial loads to avoid unnecessary delay
            await handleAuthChange(
              session ? "INITIAL_SESSION" : "SIGNED_OUT",
              session
            );
          }
        }
      } catch (error) {
        console.error("AuthProvider: Error in initial session check:", error);

        // Handle network errors with grace period
        if (
          error instanceof Error &&
          (error.message.includes("fetch") ||
            error.message.includes("network") ||
            error.message.includes("timeout"))
        ) {
          console.log("AuthProvider: Network error in initial session check");
          handleNetworkError();
        } else {
          if (mounted) {
            setLoading(false);
            setInitialLoadComplete(true);
          }
        }
      }
    };

    checkInitialSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, [supabase, handleAuthChange, handleNetworkError, user]);

  // Sign out function - defined before being used in effects
  const signOut = useCallback(async () => {
    try {
      console.log("AuthProvider: Signing out");

      // Broadcast logout to all tabs before local logout
      if (broadcastChannelRef.current && user) {
        try {
          broadcastChannelRef.current.postMessage({
            type: "LOGOUT_ALL_TABS",
            timestamp: Date.now(),
          });
        } catch (error) {
          console.warn("AuthProvider: Failed to broadcast logout:", error);
        }
      }

      // Immediately clear state
      setUser(null);
      setProfile(null);
      setLoading(false);

      // Clear auth cache
      AuthCache.clearAll();

      // Clear any remaining session storage (but Supabase now handles cookies)
      if (typeof window !== "undefined") {
        try {
          // Only clear our custom cache, let Supabase handle its own storage
          sessionStorage.removeItem("jswp-profile-cache");
          sessionStorage.removeItem("jswp-session-cache");
        } catch (error) {
          console.warn("AuthProvider: Failed to clear cache:", error);
        }
      }

      if (supabase) {
        await supabase.auth.signOut({ scope: "global" });
      }

      // Force redirect to login
      if (typeof window !== "undefined") {
        window.location.replace("/");
      }
    } catch (error) {
      console.error("AuthProvider: Error signing out:", error);
      // Still redirect even if signout fails
      if (typeof window !== "undefined") {
        window.location.replace("/");
      }
    }
  }, [supabase, user]);

  // Browser close detection and cleanup
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeUnload = () => {
      console.log("AuthProvider: Browser closing, clearing session storage");

      // Clear our custom cache (Supabase handles its own storage)
      try {
        sessionStorage.removeItem("jswp-profile-cache");
        sessionStorage.removeItem("jswp-session-cache");
      } catch (error) {
        console.warn("AuthProvider: Failed to clear cache:", error);
      }

      // Broadcast logout to other tabs
      if (broadcastChannelRef.current && user) {
        try {
          broadcastChannelRef.current.postMessage({
            type: "LOGOUT_ALL_TABS",
            timestamp: Date.now(),
          });
        } catch (error) {
          console.warn("AuthProvider: Failed to broadcast logout:", error);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("AuthProvider: Page became hidden");
      } else {
        console.log("AuthProvider: Page became visible, checking session");
        // When page becomes visible, verify session is still valid
        if (user && supabase) {
          supabase.auth.getSession().then((result: any) => {
            const session = result.data?.session;
            const error = result.error;
            if (!session && user) {
              console.log(
                "AuthProvider: Session lost while page was hidden, signing out"
              );
              signOut();
            }
          });
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, supabase, signOut]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Fallback timeout for initial load - keep it very short to show login quickly
  useEffect(() => {
    // Use 3 seconds max to avoid wasting user time
    const timeoutDuration = 3000; // 3 seconds

    const timeout = setTimeout(() => {
      if (!initialLoadComplete && loading) {
        console.warn(
          `AuthProvider: Initial load timeout after ${timeoutDuration}ms, setting loading to false`
        );
        setLoading(false);
        setInitialLoadComplete(true);
      }
    }, timeoutDuration);

    return () => clearTimeout(timeout);
  }, [loading, initialLoadComplete]);

  // Handle extending session during network recovery
  const handleExtendSession = useCallback(async () => {
    console.log("AuthProvider: Extending session");

    try {
      // Reset network error states
      setNetworkError(false);
      setShowNetworkRecovery(false);

      // Clear grace period
      if (networkGracePeriodRef.current) {
        clearTimeout(networkGracePeriodRef.current);
        networkGracePeriodRef.current = null;
      }

      // Broadcast session extension to other tabs
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            type: "EXTEND_SESSION",
            timestamp: Date.now(),
          });
        } catch (error) {
          console.warn(
            "AuthProvider: Failed to broadcast session extension:",
            error
          );
        }
      }

      // Verify session is still valid with Supabase
      if (supabase) {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error || !session) {
          console.log("AuthProvider: Session no longer valid, signing out");
          await signOut();
          return;
        }
      }

      console.log("AuthProvider: Session extended successfully");
    } catch (error) {
      console.error("AuthProvider: Error extending session:", error);
      // On error, sign out for security
      await signOut();
    }
  }, [supabase, signOut]);

  // Handle closing the network recovery modal
  const handleCloseNetworkRecovery = useCallback(() => {
    setShowNetworkRecovery(false);
    // Keep the grace period running, just hide the modal
  }, []);

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
