// app/dashboard/test/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth/OptimizedAuthProvider";

export default function DashboardTestPage() {
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [profileInfo, setProfileInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user, profile, loading: authLoading } = useAuth();

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      
      // Check session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      setSessionInfo({
        hasSession: !!sessionData?.session,
        user: sessionData?.session?.user,
        error: sessionError,
        timestamp: new Date().toISOString()
      });

      // Check profile if we have a user
      if (sessionData?.session?.user) {
        const { data: profileData, error: profileError } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", sessionData.session.user.id)
          .single();
        
        setProfileInfo({
          data: profileData,
          error: profileError,
          timestamp: new Date().toISOString()
        });
      }

      setLoading(false);
    }

    checkAuth();
  }, []);

  if (loading || authLoading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Loading authentication state...</h1>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard Authentication Test</h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">AuthProvider State</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
          {JSON.stringify({
            hasUser: !!user,
            userId: user?.id,
            userEmail: user?.email,
            hasProfile: !!profile,
            profileRole: profile?.role,
            profileEmail: profile?.email,
            loading: authLoading
          }, null, 2)}
        </pre>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Direct Session Check</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
          {JSON.stringify(sessionInfo, null, 2)}
        </pre>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Profile Data</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
          {JSON.stringify(profileInfo, null, 2)}
        </pre>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Actions</h2>
        <div className="space-x-4">
          <button
            onClick={async () => {
              const supabase = createClient();
              const { error } = await supabase.auth.signOut();
              if (error) {
                console.error("Sign out error:", error);
              } else {
                window.location.href = "/";
              }
            }}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Sign Out
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh Page
          </button>
          
          <button
            onClick={() => window.location.href = "/dashboard"}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}