// lib/auth/types.ts
import { User } from "@supabase/supabase-js";

export type UserRole = 
  | "super_admin" 
  | "district_admin" 
  | "school_admin" 
  | "teacher" 
  | "student";

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  district_id: string | null;
  school_id: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  updated_at: string;
  // Optional related data that may be populated by joins
  districts?: {
    id: string;
    name: string;
    domain: string | null;
    logo_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
  };
  schools?: {
    id: string;
    name: string;
  };
}

export interface District {
  id: string;
  name: string;
  domain: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface School {
  id: string;
  district_id: string;
  name: string;
  address: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  user: User;
  profile: UserProfile;
  expiresAt: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
}

export interface AuthError {
  code: string;
  message: string;
  details?: any;
}

export type AuthResult<T> = 
  | { success: true; data: T }
  | { success: false; error: AuthError };

// Route protection configuration
export interface RouteConfig {
  requireAuth: boolean;
  allowedRoles?: UserRole[];
  redirectTo?: string;
}

// Session configuration defaults (for client-side code that imports types)
// Actual configuration is in session-config.ts for server-side use
export const SESSION_CONFIG = {
  maxAge: 60 * 60 * 24, // 24 hours in seconds
  updateAge: 60 * 15, // Update session if older than 15 minutes
  cookieName: "jswp-session",
} as const;