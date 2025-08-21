// lib/redirect-handler.ts
"use client";

import { UserProfile } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

export interface RedirectOptions {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  currentPath: string;
}

export class RedirectHandler {
  private static redirectInProgress = false;
  private static lastRedirectTime = 0;
  private static REDIRECT_COOLDOWN = 5000; // 5 seconds cooldown

  /**
   * Centralized redirect logic for authenticated users
   */
  static handleAuthenticatedRedirect({
    user,
    profile,
    loading,
    currentPath,
  }: RedirectOptions): {
    shouldRedirect: boolean;
    targetPath: string | null;
    reason: string;
  } {
    // Don't redirect if auth is still loading
    if (loading) {
      return { shouldRedirect: false, targetPath: null, reason: "loading" };
    }

    // Don't redirect if no user or profile
    if (!user || !profile) {
      return { shouldRedirect: false, targetPath: null, reason: "no_auth" };
    }

    // Don't redirect if already in progress or within cooldown period
    const now = Date.now();
    if (
      this.redirectInProgress ||
      now - this.lastRedirectTime < this.REDIRECT_COOLDOWN
    ) {
      return { shouldRedirect: false, targetPath: null, reason: "in_progress" };
    }

    // Determine correct path based on role and current location
    const isOnLoginPage = currentPath === "/" || currentPath === "/login";
    const isOnAdminPage = currentPath === "/admin";
    const isOnDashboard = currentPath.startsWith("/dashboard");
    const isOnSuperAdmin = currentPath.startsWith("/super-admin");

    const isSuperAdmin = profile.role === "super_admin";

    // Super admin redirects
    if (isSuperAdmin) {
      if (isOnLoginPage) {
        return {
          shouldRedirect: true,
          targetPath: "/admin",
          reason: "super_admin_to_admin_login",
        };
      }
      if (isOnDashboard) {
        return {
          shouldRedirect: true,
          targetPath: "/super-admin",
          reason: "super_admin_to_super_admin_dashboard",
        };
      }
      if (isOnAdminPage) {
        return {
          shouldRedirect: true,
          targetPath: "/super-admin",
          reason: "super_admin_logged_in",
        };
      }
    }

    // Regular user redirects
    if (!isSuperAdmin) {
      if (isOnLoginPage || isOnAdminPage) {
        return {
          shouldRedirect: true,
          targetPath: "/dashboard",
          reason: "regular_user_to_dashboard",
        };
      }
      if (isOnSuperAdmin) {
        return {
          shouldRedirect: true,
          targetPath: "/dashboard",
          reason: "regular_user_from_super_admin",
        };
      }
    }

    return {
      shouldRedirect: false,
      targetPath: null,
      reason: "no_redirect_needed",
    };
  }

  /**
   * Perform the actual redirect
   */
  static performRedirect(targetPath: string, reason: string): void {
    const now = Date.now();

    if (
      this.redirectInProgress ||
      now - this.lastRedirectTime < this.REDIRECT_COOLDOWN
    ) {
      return;
    }

    this.redirectInProgress = true;
    this.lastRedirectTime = now;

    console.log(`RedirectHandler: Redirecting to ${targetPath} (${reason})`);

    // Use replace to avoid back button issues
    if (typeof window !== "undefined") {
      window.location.replace(targetPath);
    }

    // Reset flag after a longer delay to prevent loops
    setTimeout(() => {
      this.redirectInProgress = false;
    }, 10000); // 10 seconds to ensure redirect completes
  }

  /**
   * Check if user should be shown a role mismatch message
   */
  static getRoleMismatchMessage(
    profile: UserProfile | null,
    currentPath: string
  ): string | null {
    if (!profile) return null;

    const isOnAdminPage = currentPath === "/admin";
    const isOnLoginPage = currentPath === "/" || currentPath === "/login";
    const isSuperAdmin = profile.role === "super_admin";

    if (isSuperAdmin && isOnLoginPage) {
      return "Super Admin users must use the administrator login page to access the system.";
    }

    if (!isSuperAdmin && isOnAdminPage) {
      return "Access denied. Super Admin credentials required. Please use the regular login page for district users.";
    }

    return null;
  }

  /**
   * Reset redirect state (for testing or error recovery)
   */
  static resetRedirectState(): void {
    this.redirectInProgress = false;
    this.lastRedirectTime = 0;
  }

  /**
   * Check if redirect is currently blocked
   */
  static isRedirectBlocked(): boolean {
    const now = Date.now();
    return (
      this.redirectInProgress ||
      now - this.lastRedirectTime < this.REDIRECT_COOLDOWN
    );
  }
}
