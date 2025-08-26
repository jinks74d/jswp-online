// app/admin/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Shield, Eye, EyeOff, AlertCircle, ArrowLeft } from "lucide-react";
import { useAuth } from "@/components/auth/OptimizedAuthProvider";
import { RedirectHandler } from "@/lib/redirect-handler";
import {
  LoadingState,
  RedirectingState,
  RoleMismatchState,
} from "@/components/ui/LoadingStates";
import Link from "next/link";

export default function SuperAdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  console.log(
    "SuperAdminLoginPage: Component rendered at",
    new Date().toISOString()
  );

  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  console.log("SuperAdminLoginPage: useAuth values:", {
    hasUser: !!user,
    hasProfile: !!profile,
    authLoading,
    userEmail: user?.email,
    profileRole: profile?.role,
  });

  // Initialize Supabase client only once
  useEffect(() => {
    if (typeof window !== "undefined" && !supabaseRef.current) {
      supabaseRef.current = createClient();
    }
  }, []);

  // Simplified redirect handling using centralized logic
  useEffect(() => {
    const redirectResult = RedirectHandler.handleAuthenticatedRedirect({
      user,
      profile,
      loading: authLoading || loading,
      currentPath: "/admin",
    });

    if (redirectResult.shouldRedirect && redirectResult.targetPath) {
      RedirectHandler.performRedirect(
        redirectResult.targetPath,
        redirectResult.reason
      );
    }
  }, [user, profile, authLoading, loading]);

  // Show loading state while auth is being determined
  if (authLoading) {
    return <LoadingState type="auth" />;
  }

  // Handle role mismatch and redirecting states
  if (user && profile) {
    const roleMismatchMessage = RedirectHandler.getRoleMismatchMessage(
      profile,
      "/admin"
    );

    if (roleMismatchMessage) {
      return (
        <RoleMismatchState
          message={roleMismatchMessage}
          userRole={profile.role}
          onRedirect={() =>
            RedirectHandler.performRedirect(
              "/dashboard",
              "role_mismatch_redirect"
            )
          }
          onSignOut={async () => {
            if (supabaseRef.current) {
              await supabaseRef.current.auth.signOut();
              window.location.reload();
            }
          }}
        />
      );
    }

    // Show redirecting state
    return (
      <RedirectingState
        userType={profile.role === "super_admin" ? "super_admin" : "regular"}
        userName={profile.first_name || profile.email}
        targetPath={
          profile.role === "super_admin" ? "/super-admin" : "/dashboard"
        }
      />
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Reset redirect state for fresh login
    RedirectHandler.resetRedirectState();

    if (!supabaseRef.current) {
      setError("Authentication service not available");
      setLoading(false);
      return;
    }

    // Increase timeout to 30 seconds for slower connections
    const loginTimeout = setTimeout(() => {
      console.error("SuperAdmin login timeout - resetting state");
      setLoading(false);
      setError("Login timed out. Please try again.");
    }, 30000); // 30 second timeout

    try {
      console.log("SuperAdminLogin: Starting authentication for", email);

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
        "SuperAdminLogin: Authentication successful, manually fetching profile"
      );

      // Clear the timeout since authentication was successful
      clearTimeout(loginTimeout);

      // Manual profile fetch since AuthProvider isn't triggering
      try {
        console.log("SuperAdminLogin: Fetching user profile...");

        // Add timeout to profile fetch
        const profilePromise = supabaseRef.current
          .from("user_profiles")
          .select("role, district_id, email, first_name, last_name")
          .eq("id", authData.user.id)
          .single();

        const profileTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Profile fetch timeout")), 2000)
        );

        console.log("SuperAdminLogin: Executing profile query with timeout...");
        const profileResult = await Promise.race([
          profilePromise,
          profileTimeout,
        ]);
        console.log("SuperAdminLogin: Profile query result:", profileResult);

        const { data: profileData, error: profileError } = profileResult;

        if (profileError || !profileData) {
          console.error("SuperAdminLogin: Profile fetch failed:", profileError);
          throw new Error(
            `Could not fetch user profile: ${
              profileError?.message || "No data"
            }`
          );
        }

        console.log("SuperAdminLogin: Profile fetched:", profileData.role);

        // Validate user is super admin
        if (profileData.role !== "super_admin") {
          await supabaseRef.current.auth.signOut();
          throw new Error(
            "Access denied. Super Admin credentials required. Please use the regular login page for district users."
          );
        }

        console.log(
          "SuperAdminLogin: Super admin validated, redirecting to /super-admin"
        );

        // Immediate redirect to super admin dashboard
        setLoading(false);
        window.location.href = "/super-admin";
      } catch (profileError) {
        console.error(
          "SuperAdminLogin: Profile validation failed:",
          profileError
        );
        throw profileError;
      }
    } catch (error: any) {
      console.error("SuperAdmin login error:", error);
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
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Back to Regular Login */}
        <div className="flex items-center justify-center">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Regular Login
          </Link>
        </div>

        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Super Admin Portal
          </h1>
          <p className="text-gray-600">System administration access</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-md p-8 border-2 border-red-200">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Administrator Login
            </h2>
            <p className="text-sm text-gray-600">
              Access system administration tools and manage districts
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
                htmlFor="admin-email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Administrator Email
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 text-gray-900"
                placeholder="Enter your admin email"
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Administrator Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 pr-10 text-gray-900"
                  placeholder="Enter your admin password"
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
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                "Sign in as Super Admin"
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-red-50 rounded-md border border-red-200">
            <h4 className="text-sm font-medium text-red-900 mb-2">
              🔒 Security Notice
            </h4>
            <p className="text-xs text-red-700">
              This portal is for system administrators only. All access attempts
              are logged and monitored.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>Need help? Contact your system administrator</p>
          <p className="mt-2">
            <Link href="/" className="text-blue-600 hover:text-blue-700">
              Regular user? Use the standard login page
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
