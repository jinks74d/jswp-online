// components/auth/AuthDebug.tsx
"use client";

import { useAuth } from "./AuthProvider";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

interface AuthDebugProps {
  enabled?: boolean;
}

export function AuthDebug({ enabled = false }: AuthDebugProps) {
  const { user, profile, loading } = useAuth();
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const checkSession = async () => {
      try {
        const client = createClient();
        const { data, error } = await client.auth.getSession();
        
        setSessionInfo({
          hasSession: !!data.session,
          userId: data.session?.user?.id,
          userEmail: data.session?.user?.email,
          error: error?.message,
          timestamp: new Date().toISOString(),
        });

        if (error) {
          setErrors(prev => [...prev, `Session error: ${error.message}`]);
        }
      } catch (err) {
        setErrors(prev => [...prev, `Debug error: ${err}`]);
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 5000);
    return () => clearInterval(interval);
  }, [enabled]);

  if (!enabled || process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg text-xs max-w-sm">
      <h3 className="font-bold mb-2">Auth Debug</h3>
      <div className="space-y-1">
        <div>Loading: {loading ? 'true' : 'false'}</div>
        <div>User: {user ? user.id : 'null'}</div>
        <div>Profile: {profile ? `${profile.role} (${profile.email})` : 'null'}</div>
        <div>Session Valid: {sessionInfo?.hasSession ? 'true' : 'false'}</div>
        {sessionInfo?.error && (
          <div className="text-red-300">Session Error: {sessionInfo.error}</div>
        )}
        {errors.length > 0 && (
          <div className="mt-2">
            <div className="font-semibold">Recent Errors:</div>
            {errors.slice(-3).map((error, idx) => (
              <div key={idx} className="text-red-300">{error}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}