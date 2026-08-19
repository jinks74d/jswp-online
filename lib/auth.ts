/**
 * Server-side auth helpers for RSCs and Route Handlers.
 *
 * requireUser() and requireRole() call redirect() on failure — they never
 * return null. Callers can trust the return value is always a valid profile.
 */

import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import type { UserProfiles, Database } from "@/lib/database.types";

type JswpRole = Database["public"]["Enums"]["jswp_role"];

/* ─── Core: get the current user + profile ────────────────────────────── */

/**
 * Returns the authenticated user and their profile, or null values if
 * not authenticated. Does NOT redirect — use requireUser() for that.
 *
 * Wrapped in React cache(): memoized for the lifetime of a single request.
 * Every route segment's layout guards with requireRole/requireUser and the
 * page under it guards again, so an uncached read costs 2-3 duplicate
 * auth.getUser() round trips plus the same number of user_profiles selects
 * per render. The cache collapses those to one of each. Scope is per-request,
 * so no state leaks between users, and nothing in the app mutates the
 * caller's own profile mid-request (the only user_profiles writes are
 * admin-client inserts for other users).
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<{
  user: { id: string; email?: string } | null;
  profile: UserProfiles | null;
  error: unknown;
}> {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return { user: null, profile: null, error };
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return { user, profile: null, error: profileError };
    }

    return { user, profile, error: null };
  } catch (error) {
    return { user: null, profile: null, error };
  }
});

/* ─── Guards: redirect on failure ─────────────────────────────────────── */

/**
 * Requires an authenticated user. Redirects to /login if not signed in.
 * Returns the user profile on success.
 */
export async function requireUser(): Promise<UserProfiles> {
  const { profile } = await getCurrentUser();

  if (!profile) {
    redirect("/login");
  }

  return profile;
}

/**
 * Requires the user to have one of the specified roles.
 * Redirects to /login if unauthenticated, /forbidden if wrong role.
 *
 * @example
 *   const profile = await requireRole("teacher");
 *   const profile = await requireRole(["teacher", "school_admin"]);
 */
export async function requireRole(
  role: JswpRole | JswpRole[]
): Promise<UserProfiles> {
  const profile = await requireUser();

  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(profile.role)) {
    redirect("/forbidden");
  }

  return profile;
}

/* ─── Context helpers ─────────────────────────────────────────────────── */

/**
 * Returns the current user's district ID.
 * Redirects to /login if not authenticated.
 *
 * Throws if the user has no district. Super admins are districtless, so they
 * must never reach district-scoped code paths that call this.
 */
export async function getCurrentDistrict(): Promise<string> {
  const profile = await requireUser();
  if (!profile.district_id) {
    throw new Error(
      "Current user has no district (super admins are districtless)."
    );
  }
  return profile.district_id;
}

/**
 * Returns the current user's school ID (null for super/district admins).
 * Redirects to /login if not authenticated.
 */
export async function getCurrentSchool(): Promise<string | null> {
  const profile = await requireUser();
  return profile.school_id;
}

/* ─── Utility functions (kept from legacy) ────────────────────────────── */

/** Check if a role is in an allowed list. */
export function hasRole(userRole: JswpRole, allowedRoles: JswpRole[]): boolean {
  return allowedRoles.includes(userRole);
}

/** Check if a profile can access a given district. */
export function canAccessDistrict(
  profile: UserProfiles,
  districtId: string
): boolean {
  if (profile.role === "super_admin") return true;
  return profile.district_id === districtId;
}

/** Get the default redirect path after login based on role. */
export function getRedirectPath(userRole: JswpRole): string {
  switch (userRole) {
    case "district_admin":
      return "/district";
    case "district_analyst":
      // Not /district — that tree's layout gates on district_admin and is
      // scoped to one district. The analyst is cross-district and read-only,
      // which is a different mental model and so a sibling route (0061).
      return "/analytics";
    case "school_admin":
      return "/school";
    case "super_admin":
      return "/admin";
    case "teacher":
      return "/dashboard";
    case "student":
      return "/student";
    default:
      return "/";
  }
}
