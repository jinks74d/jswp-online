// components/dashboard/FallbackDashboard.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function FallbackDashboard() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login if server-side auth fails
    // This gives the user a chance to log in again
    const timer = setTimeout(() => {
      router.push("/login?redirect=/dashboard");
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Dashboard</h2>
        <p className="text-gray-600 mb-4">Verifying your authentication...</p>
        <p className="text-sm text-gray-500">
          If this takes too long, you will be redirected to login.
        </p>
      </div>
    </div>
  );
}