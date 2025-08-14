// app/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase";

import { Eye, EyeOff, AlertCircle, Shield } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthCache } from "@/lib/auth-cache";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRedirected = useRef(false);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  // Check if we've already attempted a redirect in this session
  const hasAttemptedRedirect = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const redirectAttempted = sessionStorage.getItem(
        "jswp-redirect-attempted"
      );
      if (redirectAttempted === "true") {
        hasAttemptedRedirect.current = true;
        hasRedirected.current = true;
      }
    }
  }, []);

  console.log("LoginPage: Component rendered at", new Date().toISOString());

  const { user, profile, loading: authLoading } = useAuth();

  console.log("LoginPage: useAuth values:", {
    hasUser: !!user,
    hasProfile: !!profile,
    authLoading,
    userEmail: user?.email,
    profileRole: profile?.role,
  });

  // Debug auth state changes
  useEffect(() => {
    console.log("Login: Auth state update detected:", {
      authLoading,
      hasUser: !!user,
      hasProfile: !!profile,
      userEmail: user?.email,
      profileRole: profile?.role,
      timestamp: new Date().toISOString(),
    });
  }, [user, profile, authLoading]);

  // Initialize Supabase client only once
  useEffect(() => {
    if (typeof window !== "undefined" && !supabaseRef.current) {
      supabaseRef.current = createClient();
    }
  }, []);

  // Handle redirects for already authenticated users visiting the login page
  // This prevents users from getting stuck on login page when already logged in
  useEffect(() => {
    console.log("Login: Redirect check:", {
      authLoading,
      hasUser: !!user,
      hasProfile: !!profile,
      isLoading: loading,
      hasRedirected: hasRedirected.current,
      hasAttemptedRedirect: hasAttemptedRedirect.current,
      userEmail: user?.email,
      profileRole: profile?.role,
    });

    // Only redirect if auth is fully loaded, we have both user and profile, not currently logging in, and haven't redirected yet
    // BUT: Don't auto-redirect super admins - they should use /admin to login
    if (
      !authLoading &&
      user &&
      profile &&
      profile.role !== "super_admin" &&
      !loading &&
      !hasRedirected.current &&
      !hasAttemptedRedirect.current
    ) {
      hasRedirected.current = true;
      hasAttemptedRedirect.current = true;

      // Set sessionStorage flag to prevent future redirect attempts
      if (typeof window !== "undefined") {
        sessionStorage.setItem("jswp-redirect-attempted", "true");
      }

      console.log("Login: Authenticated user detected, redirecting...", {
        userId: user.id,
        role: profile.role,
        email: profile.email,
      });

      // Only regular users reach this point (super admins are excluded in the condition above)
      console.log("Login: Regular user detected, redirecting to /dashboard");
      window.location.href = "/dashboard";
    }
  }, [user, profile, authLoading, loading]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  // Show loading state while auth is being determined
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-gray-700 font-medium">
                Checking authentication...
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Please wait while we verify your session
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show redirecting state if we have user and profile (but not for super admins)
  if (user && profile && !hasRedirected.current) {
    // Super admins should not be auto-redirected from regular login
    if (profile.role === "super_admin") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <div className="bg-white rounded-lg shadow-md p-8">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Shield className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Super Admin Detected
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                You are logged in as a Super Administrator. Please use the
                dedicated admin portal to access your dashboard.
              </p>
              <div className="space-y-3">
                <a
                  href="/admin"
                  className="block w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
                >
                  Go to Admin Portal
                </a>
                <button
                  onClick={async () => {
                    if (supabaseRef.current) {
                      await supabaseRef.current.auth.signOut();
                      window.location.reload();
                    }
                  }}
                  className="block w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Regular users get redirecting message
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-gray-700 font-medium">
                Redirecting to dashboard...
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Welcome back, {profile.first_name || profile.email}!
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Clear any previous redirect attempts and auth cache for fresh login
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("jswp-redirect-attempted");
    }
    hasAttemptedRedirect.current = false;
    hasRedirected.current = false;

    // Clear auth cache to ensure fresh login
    AuthCache.clearAll();

    if (!supabaseRef.current) {
      setError("Authentication service not available");
      setLoading(false);
      return;
    }

    // Increase timeout to 30 seconds for slower connections
    const loginTimeout = setTimeout(() => {
      console.error("Login timeout - resetting state");
      setLoading(false);
      setError("Login timed out. Please try again.");
    }, 30000); // 30 second timeout

    try {
      console.log("Login: Starting authentication for", email);

      // Authenticate with Supabase with timeout
      const authPromise = supabaseRef.current.auth.signInWithPassword({
        email,
        password,
      });

      const authResult = await Promise.race([
        authPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Authentication timeout")), 3000)
        ),
      ]);

      const { data: authData, error: authError } = authResult as any;

      if (authError) {
        clearTimeout(loginTimeout);
        throw authError;
      }

      if (!authData.user) {
        clearTimeout(loginTimeout);
        throw new Error("No user returned from authentication");
      }

      console.log(
        "Login: Authentication successful, manually fetching profile"
      );

      // Clear the timeout since authentication was successful
      clearTimeout(loginTimeout);

      // Manual profile fetch since AuthProvider isn't triggering
      try {
        console.log("Login: Fetching user profile...");

        // Add timeout to profile fetch
        const profilePromise = supabaseRef.current
          .from("user_profiles")
          .select("role, district_id, email, first_name, last_name")
          .eq("id", authData.user.id)
          .single();

        const profileTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Profile fetch timeout")), 2000)
        );

        console.log("Login: Executing profile query with timeout...");
        const profileResult = await Promise.race([
          profilePromise,
          profileTimeout,
        ]);
        console.log("Login: Profile query result:", profileResult);

        const { data: profileData, error: profileError } = profileResult;

        if (profileError || !profileData) {
          console.error("Login: Profile fetch failed:", profileError);
          throw new Error(
            `Could not fetch user profile: ${
              profileError?.message || "No data"
            }`
          );
        }

        console.log("Login: Profile fetched:", profileData.role);

        // Validate user is NOT super admin (they should use /admin)
        if (profileData.role === "super_admin") {
          await supabaseRef.current.auth.signOut();
          throw new Error(
            "Super Admin users must use the administrator login page at /admin to access the system."
          );
        }

        // Determine redirect path (always dashboard for regular users)
        const targetPath = "/dashboard";

        console.log(`Login: Profile validated, redirecting to ${targetPath}`);

        // Immediate redirect
        setLoading(false);
        window.location.href = targetPath;
      } catch (profileError) {
        console.error("Login: Profile validation failed:", profileError);
        throw profileError;
      }
    } catch (error: any) {
      console.error("Login error:", error);
      clearTimeout(loginTimeout);
      setError(error.message || "An error occurred during login");
      setLoading(false);

      // Ensure we're signed out on error
      try {
        if (supabaseRef.current) {
          await supabaseRef.current.auth.signOut();
        }
      } catch (signOutError) {
        console.error("Error signing out after login failure:", signOutError);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">JSWP Online</h1>
          <p className="text-gray-600">
            Sign in to access your assignments and tools
          </p>
        </div>

        {/* Admin Login Link */}
        <div className="flex items-center justify-center">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Shield className="w-4 h-4" />
            Administrator Login
          </Link>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              User Login
            </h2>
            <p className="text-sm text-gray-600">
              Access your district assignments and tools
            </p>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-800">
                  Login Failed
                </h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="Enter your email"
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 pr-10 text-gray-900"
                  placeholder="Enter your password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* Demo credentials info */}
          <div className="mt-6 p-4 bg-gray-50 rounded-md">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              User Access
            </h4>
            <p className="text-xs text-gray-600">
              Use your district-assigned credentials to access assignments and
              tools.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>Need help? Contact your district administrator</p>
          <p className="mt-2">
            <Link href="/admin" className="text-blue-600 hover:text-blue-700">
              System Administrator? Use the admin portal
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
