// components/auth/AuthDebugger.tsx
"use client";

import { useAuth } from "./AuthProvider";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

// Only show in development
const DEBUG_ENABLED = process.env.NODE_ENV === 'development';

export function AuthDebugger() {
  const { user, profile, loading } = useAuth();
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!DEBUG_ENABLED) return;
    
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      setSessionInfo({ session: !!session, error: error?.message });
    };
    
    checkSession();
    const interval = setInterval(checkSession, 1000);
    return () => clearInterval(interval);
  }, [supabase.auth]);

  if (!DEBUG_ENABLED) return null;

  return (
    <div className="fixed top-0 right-0 bg-black text-white p-2 text-xs z-50 max-w-xs">
      <div>Auth Loading: {loading.toString()}</div>
      <div>User: {user ? user.id.slice(0, 8) : 'null'}</div>
      <div>Profile: {profile ? profile.role : 'null'}</div>
      <div>Session: {sessionInfo?.session ? 'valid' : 'invalid'}</div>
      {sessionInfo?.error && <div>Error: {sessionInfo.error}</div>}
      <div>URL: {typeof window !== 'undefined' ? window.location.pathname : ''}</div>
    </div>
  );
}