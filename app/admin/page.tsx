// app/admin/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Eye, EyeOff, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Only allow super admin access from this page
        if (result.profile.role === "super_admin") {
          router.push("/super-admin");
          router.refresh();
        } else {
          setError("Only super administrators can access this page");
        }
      } else {
        setError(result.error || "Failed to sign in");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Back Link */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-indigo-200 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to User Login
          </Link>
        </div>

        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Administrator Portal</h1>
          <p className="text-indigo-200">
            Super Administrator Access Only
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-lg p-8 border border-white border-opacity-20">
          {error && (
            <div className="mb-4 bg-red-500 bg-opacity-20 border border-red-400 rounded-md p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-300 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-200">
                  Authentication Failed
                </h3>
                <p className="text-sm text-red-300 mt-1">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-white mb-2"
              >
                Administrator Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white bg-opacity-20 border border-white border-opacity-30 rounded-md placeholder-gray-300 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                placeholder="Enter administrator email"
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-white mb-2"
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
                  className="w-full px-3 py-2 bg-white bg-opacity-20 border border-white border-opacity-30 rounded-md placeholder-gray-300 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent pr-10"
                  placeholder="Enter administrator password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-300 hover:text-white"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Authenticating...</span>
                </div>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Administrator Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-6 p-4 bg-white bg-opacity-10 rounded-md border border-white border-opacity-20">
            <h4 className="text-sm font-medium text-white mb-2">
              ⚠️ Restricted Access
            </h4>
            <p className="text-xs text-indigo-200">
              This portal is restricted to system administrators only. 
              Unauthorized access attempts are monitored and logged.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-indigo-300">
          <p>JSWP Online Administration Portal</p>
          <p className="mt-1 text-xs">
            For security questions, contact system support
          </p>
        </div>
      </div>
    </div>
  );
}