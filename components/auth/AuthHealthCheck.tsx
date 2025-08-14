"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";

interface HealthStatus {
  status: 'healthy' | 'warning' | 'error';
  lastCheck: Date;
  issues: string[];
}

export function AuthHealthCheck() {
  const [health, setHealth] = useState<HealthStatus>({
    status: 'healthy',
    lastCheck: new Date(),
    issues: []
  });
  const { user, profile, loading } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    const performHealthCheck = async () => {
      const issues: string[] = [];
      let status: HealthStatus['status'] = 'healthy';

      try {
        // Check 1: Session consistency
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          issues.push(`Session error: ${sessionError.message}`);
          status = 'error';
        }

        // Check 2: User/session mismatch
        if (user && !session) {
          issues.push('User exists but no session found');
          status = 'warning';
        } else if (!user && session) {
          issues.push('Session exists but no user in context');
          status = 'warning';
        }

        // Check 3: Profile consistency
        if (user && !profile && !loading) {
          issues.push('User exists but profile not loaded');
          status = 'warning';
        }

        // Check 4: Token freshness
        if (session?.expires_at) {
          const expiresAt = new Date(session.expires_at * 1000);
          const timeUntilExpiry = expiresAt.getTime() - Date.now();
          const fiveMinutes = 5 * 60 * 1000;
          
          if (timeUntilExpiry < fiveMinutes && timeUntilExpiry > 0) {
            issues.push('Session expires soon');
            status = status === 'error' ? 'error' : 'warning';
          } else if (timeUntilExpiry <= 0) {
            issues.push('Session expired');
            status = 'error';
          }
        }

        // Check 5: Storage accessibility
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem('health-check', 'test');
            window.localStorage.removeItem('health-check');
          } catch (error) {
            issues.push('localStorage not accessible');
            status = 'warning';
          }
        }

        setHealth({
          status,
          lastCheck: new Date(),
          issues
        });

      } catch (error) {
        setHealth({
          status: 'error',
          lastCheck: new Date(),
          issues: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
        });
      }
    };

    // Initial check
    performHealthCheck();

    // Periodic health checks every 30 seconds
    const interval = setInterval(performHealthCheck, 30000);

    return () => clearInterval(interval);
  }, [user, profile, loading, supabase.auth]);

  // Don't render anything in production
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  // Only show if there are issues or in development
  if (health.status === 'healthy' && process.env.NODE_ENV !== 'development') {
    return null;
  }

  const getStatusColor = () => {
    switch (health.status) {
      case 'healthy': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
    }
  };

  return (
    <div className="fixed top-4 left-4 z-50 max-w-sm">
      <div className={`border rounded-lg p-3 shadow-sm ${getStatusColor()}`}>
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-2 h-2 rounded-full ${
            health.status === 'healthy' ? 'bg-green-500' :
            health.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
          }`} />
          <span className="font-medium text-sm">
            Auth Health: {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
          </span>
        </div>
        
        {health.issues.length > 0 && (
          <div className="space-y-1">
            {health.issues.map((issue, index) => (
              <div key={index} className="text-xs">
                • {issue}
              </div>
            ))}
          </div>
        )}
        
        <div className="text-xs opacity-70 mt-2">
          Last check: {health.lastCheck.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}