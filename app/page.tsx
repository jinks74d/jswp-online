// app/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase";

import { Eye, EyeOff, AlertCircle, Shield } from "lucide-react";
import { useAuth } from "@/components/auth/OptimizedAuthProvider";
import { AuthCache } from "@/lib/auth-cache";
import { RedirectHandler } from "@/lib/redirect-handler";
import {
  LoadingState,
  RedirectingState,
  RoleMismatchState,
} from "@/components/ui/LoadingStates";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const redirectAttempted = useRef(false);

  const { user, profile, loading: authLoading } = useAuth();
  
  // Check for error in URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error') === 'access_denied') {
      setError("Access Denied: Please log in to access your dashboard");
    }
  }, []);

  // Initialize Supabase client only once
  useEffect(() => {
    if (typeof window !== "undefined" && !supabaseRef.current) {
      try {
        console.log("Initializing Supabase client...");
        supabaseRef.current = createClient();
        console.log("Supabase client initialized successfully");
      } catch (error) {
        console.error("Failed to initialize Supabase client:", error);
      }
    }
  }, []);

  // Auto-redirect authenticated users (except super admins who can choose)
  useEffect(() => {
    if (!authLoading && user && profile && !redirectAttempted.current) {
      redirectAttempted.current = true;
      
      // Only redirect regular users automatically - use Next.js router for smoother transitions
      if (profile.role !== "super_admin") {
        // Small delay to prevent flashing
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 100);
      }
    }
  }, [authLoading, user, profile]);

  // Show loading state while auth is being determined
  if (authLoading) {
    return <LoadingState type="auth" />;
  }

  // Handle authenticated users
  if (user && profile) {
    // For super admins, show the login form so they can choose where to go
    if (profile.role === "super_admin") {
      // Don't redirect, let them use the form or links
    } else {
      // Show redirecting state for regular users while redirect is happening
      return (
        <RedirectingState
          userType="regular"
          userName={profile.first_name || profile.email}
          targetPath="/dashboard"
        />
      );
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Login form submitted", { email, passwordLength: password.length });
    setLoading(true);
    setError("");

    // Clear auth cache to ensure fresh login
    AuthCache.clearAll();
    RedirectHandler.resetRedirectState();
    redirectAttempted.current = false;

    if (!supabaseRef.current) {
      console.error("Supabase client not initialized");
      setError("Authentication service not available");
      setLoading(false);
      return;
    }
    console.log("Supabase client is ready");

    // Increase timeout to 30 seconds for slower connections
    const loginTimeout = setTimeout(() => {
      console.error("Login timeout - resetting state");
      setLoading(false);
      setError("Login timed out. Please try again.");
    }, 30000); // 30 second timeout

    try {
      console.log("Attempting to sign in with Supabase...");
      // Authenticate with Supabase
      const { data: authData, error: authError } =
        await supabaseRef.current.auth.signInWithPassword({
          email,
          password,
        });

      console.log("Sign in response:", { 
        hasData: !!authData, 
        hasUser: !!authData?.user,
        hasError: !!authError,
        errorMessage: authError?.message 
      });

      if (authError) {
        clearTimeout(loginTimeout);
        throw authError;
      }

      if (!authData.user) {
        clearTimeout(loginTimeout);
        throw new Error("No user returned from authentication");
      }

      console.log("Login successful, user:", authData.user.email);
      // Clear the timeout since authentication was successful
      clearTimeout(loginTimeout);

      // Since you already have a session, just redirect to dashboard
      // The middleware will handle role-based redirects
      console.log("Redirecting to dashboard...");
      window.location.href = "/dashboard";
      
      setLoading(false);
    } catch (error: any) {
      console.error("Login error details:", error);
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
                autoComplete="email"
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
                  autoComplete="current-password"
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
            {/* Debug button - remove in production */}
            <button
              type="button"
              onClick={async () => {
                console.log("=== Testing Supabase connection ===");
                console.log("Environment vars:", {
                  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
                  hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                });
                try {
                  const client = createClient();
                  const { data: sessionData, error: sessionError } = await client.auth.getSession();
                  console.log("Session test:", { 
                    hasSession: !!sessionData?.session,
                    user: sessionData?.session?.user?.email,
                    userId: sessionData?.session?.user?.id,
                    error: sessionError 
                  });
                  
                  // If we have a session, check the profile
                  if (sessionData?.session?.user) {
                    const { data: profileData, error: profileError } = await client
                      .from("user_profiles")
                      .select("*")
                      .eq("id", sessionData.session.user.id)
                      .single();
                    
                    console.log("Profile test:", {
                      hasProfile: !!profileData,
                      role: profileData?.role,
                      email: profileData?.email,
                      error: profileError
                    });
                  }
                  
                  // Test direct navigation
                  console.log("Current location:", window.location.pathname);
                  console.log("=== End of connection test ===");
                } catch (err) {
                  console.error("Connection test failed:", err);
                }
              }}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700 underline"
            >
              Test Session & Profile (Debug)
            </button>
            
            {/* Manual navigation button for testing */}
            <button
              type="button"
              onClick={() => {
                console.log("Manually navigating to dashboard...");
                window.location.href = "/dashboard";
              }}
              className="mt-2 ml-4 text-xs text-green-600 hover:text-green-700 underline"
            >
              Go to Dashboard (Manual)
            </button>
            
            {/* Sign out button if already logged in */}
            <button
              type="button"
              onClick={async () => {
                console.log("Signing out...");
                const client = createClient();
                await client.auth.signOut();
                window.location.reload();
              }}
              className="mt-2 ml-4 text-xs text-red-600 hover:text-red-700 underline"
            >
              Sign Out (If Logged In)
            </button>
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
