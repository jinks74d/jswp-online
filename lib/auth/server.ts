// lib/auth/server.ts
import "server-only";

import { redirect } from "next/navigation";
import { getSession } from "./service";
import type { UserRole, AuthSession } from "./types";

/**
 * Server Component Auth Utilities
 * For use in Server Components and Server Actions
 */

/**
 * Require authentication - redirects if not authenticated
 */
export async function requireAuth(): Promise<AuthSession> {
  const sessionResult = await getSession();
  
  if (!sessionResult.success) {
    redirect("/login");
  }
  
  return sessionResult.data;
}

/**
 * Require specific role - redirects if not authorized
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<AuthSession> {
  const session = await requireAuth();
  
  if (!allowedRoles.includes(session.profile.role)) {
    redirect("/unauthorized");
  }
  
  return session;
}

/**
 * Get auth session without redirects (for conditional rendering)
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  const sessionResult = await getSession();
  return sessionResult.success ? sessionResult.data : null;
}

/**
 * Check if user is authenticated without redirects
 */
export async function isAuthenticated(): Promise<boolean> {
  const sessionResult = await getSession();
  return sessionResult.success;
}

/**
 * Check if user has any of the specified roles
 */
export async function hasAnyRole(roles: UserRole[]): Promise<boolean> {
  const session = await getAuthSession();
  if (!session) return false;
  
  return roles.includes(session.profile.role);
}

/**
 * Get current user role or null if not authenticated
 */
export async function getCurrentRole(): Promise<UserRole | null> {
  const session = await getAuthSession();
  return session?.profile.role || null;
}

/**
 * Require super admin access
 */
export async function requireSuperAdmin(): Promise<AuthSession> {
  return requireRole(["super_admin"]);
}

/**
 * Require admin access (super, district, or school admin)
 */
export async function requireAdmin(): Promise<AuthSession> {
  return requireRole(["super_admin", "district_admin", "school_admin"]);
}

/**
 * Require teacher or admin access
 */
export async function requireTeacherOrAdmin(): Promise<AuthSession> {
  return requireRole(["super_admin", "district_admin", "school_admin", "teacher"]);
}