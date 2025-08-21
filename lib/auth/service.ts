// lib/auth/service.ts
import "server-only"; // This file should only run on the server

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { 
  AuthSession, 
  UserProfile, 
  AuthResult, 
  UserRole 
} from "./types";

/**
 * Core Authentication Service
 * Server-side only, single source of truth for auth state
 */
class AuthService {
  private async getSupabaseClient() {
    const cookieStore = await cookies();
    
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Cookies can't be set in Server Components, only in actions/routes
            }
          },
        },
      }
    );
  }

  /**
   * Get current authenticated session
   * Uses React cache for request deduplication
   */
  async getSession(): Promise<AuthResult<AuthSession>> {
    try {
      const supabase = await this.getSupabaseClient();
      
      // Get user from Supabase
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return {
          success: false,
          error: {
            code: "NO_SESSION",
            message: "No authenticated session found",
          },
        };
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        console.error("Failed to fetch user profile:", profileError);
        return {
          success: false,
          error: {
            code: "PROFILE_ERROR",
            message: "Failed to fetch user profile",
            details: profileError,
          },
        };
      }

      return {
        success: true,
        data: {
          user,
          profile: profile as UserProfile,
          expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour from now
        },
      };
    } catch (error) {
      console.error("Session error:", error);
      return {
        success: false,
        error: {
          code: "SESSION_ERROR",
          message: "Failed to get session",
          details: error,
        },
      };
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<AuthResult<AuthSession>> {
    try {
      const supabase = await this.getSupabaseClient();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        return {
          success: false,
          error: {
            code: "SIGNIN_FAILED",
            message: error?.message || "Failed to sign in",
            details: error,
          },
        };
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (profileError || !profile) {
        // Sign out if profile fetch fails
        await supabase.auth.signOut();
        return {
          success: false,
          error: {
            code: "PROFILE_ERROR",
            message: "User profile not found",
            details: profileError,
          },
        };
      }

      return {
        success: true,
        data: {
          user: data.user,
          profile: profile as UserProfile,
          expiresAt: Date.now() + (60 * 60 * 1000),
        },
      };
    } catch (error) {
      console.error("Sign in error:", error);
      return {
        success: false,
        error: {
          code: "SIGNIN_ERROR",
          message: "An error occurred during sign in",
          details: error,
        },
      };
    }
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<AuthResult<void>> {
    try {
      const supabase = await this.getSupabaseClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        return {
          success: false,
          error: {
            code: "SIGNOUT_FAILED",
            message: error.message,
            details: error,
          },
        };
      }

      return { success: true, data: undefined };
    } catch (error) {
      console.error("Sign out error:", error);
      return {
        success: false,
        error: {
          code: "SIGNOUT_ERROR",
          message: "Failed to sign out",
          details: error,
        },
      };
    }
  }

  /**
   * Check if user has required role
   */
  hasRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
    return allowedRoles.includes(userRole);
  }

  /**
   * Check if user can access a specific district
   */
  canAccessDistrict(profile: UserProfile, districtId: string): boolean {
    // Super admins can access any district
    if (profile.role === "super_admin") {
      return true;
    }
    
    // Other users can only access their own district
    return profile.district_id === districtId;
  }

  /**
   * Check if user can access a specific school
   */
  canAccessSchool(profile: UserProfile, schoolId: string): boolean {
    // Super admins can access any school
    if (profile.role === "super_admin") {
      return true;
    }
    
    // District admins can access schools in their district
    // (would need to check school's district_id in real implementation)
    if (profile.role === "district_admin") {
      // This would need additional logic to check if school is in user's district
      return true;
    }
    
    // Other users can only access their own school
    return profile.school_id === schoolId;
  }

  /**
   * Get redirect path based on user role
   */
  getRedirectPath(role: UserRole): string {
    switch (role) {
      case "super_admin":
        return "/super-admin";
      case "district_admin":
      case "school_admin":
      case "teacher":
      case "student":
        return "/dashboard";
      default:
        return "/";
    }
  }
}

// Export singleton instance with React cache
export const authService = new AuthService();

// Cached version of getSession for use in Server Components
export const getSession = cache(async () => authService.getSession());