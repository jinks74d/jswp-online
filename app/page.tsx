// app/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase";

import { Eye, EyeOff, AlertCircle, Shield } from "lucide-react";
import Image from "next/image";
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
    if (urlParams.get("error") === "access_denied") {
      setError("Access Denied: Please log in to access your dashboard");
    }
  }, []);

  // Initialize Supabase client only once
  useEffect(() => {
    if (typeof window !== "undefined" && !supabaseRef.current) {
      try {
        supabaseRef.current = createClient();
      } catch (error) {
        console.error("Failed to initialize Supabase client:", error);
      }
    }
  }, []);

  // Auto-redirect authenticated users to their appropriate dashboard
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
      // Don't redirect super admins automatically, let them use the login form
      // Fall through to show the login form below
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
    setLoading(true);
    setError("");

    // Clear auth cache to ensure fresh login
    AuthCache.clearAll();
    RedirectHandler.resetRedirectState();
    redirectAttempted.current = false;

    if (!supabaseRef.current) {
      setError("Authentication service not available");
      setLoading(false);
      return;
    }

    // Increase timeout to 30 seconds for slower connections
    const loginTimeout = setTimeout(() => {
      setLoading(false);
      setError("Login timed out. Please try again.");
    }, 30000); // 30 second timeout

    try {
      // Authenticate with Supabase
      const { data: authData, error: authError } =
        await supabaseRef.current.auth.signInWithPassword({
          email,
          password,
        });

      if (authError) {
        clearTimeout(loginTimeout);
        throw authError;
      }

      if (!authData.user) {
        clearTimeout(loginTimeout);
        throw new Error("No user returned from authentication");
      }

      // Clear the timeout since authentication was successful
      clearTimeout(loginTimeout);

      // Since you already have a session, just redirect to dashboard
      // The middleware will handle role-based redirects
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
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="/assets/logos/JSWPOnlineLogo-p-500.png"
              alt="JSWP Online"
              width={400}
              height={160}
              priority
            />
          </div>
          <p className="text-gray-600">
            Sign in to access your assignments and tools
          </p>
        </div>


        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-xl p-8">
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

        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>Need help? Contact your district administrator</p>
        </div>
      </div>
      
      {/* Administrator Login - positioned at lower right */}
      <div className="fixed bottom-4 right-4">
        <Link
          href="/admin"
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors bg-white px-4 py-2 rounded-lg shadow-md hover:shadow-lg"
        >
          <Shield className="w-4 h-4" />
          Administrator Login
        </Link>
      </div>
    </div>
  );
}
