// lib/auth.ts
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "./supabase";
import { UserProfile, UserRole } from "./supabase";

// Get current user session (for server components)
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const supabase = await createServerSupabaseClient(cookieStore);

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return { user: null, profile: null, error };
    }

    // Get user profile with role and district info
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select(
        `
        *,
        districts:district_id(id, name, domain),
        schools:school_id(id, name)
      `
      )
      .eq("id", user.id)
      .single();

    if (profileError) {
      return { user, profile: null, error: profileError };
    }

    return { user, profile: profile as UserProfile, error: null };
  } catch (error) {
    return { user: null, profile: null, error };
  }
}

// Check if user has specific role
export function hasRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}

// Check if user is super admin
export function isSuperAdmin(userRole: UserRole): boolean {
  return userRole === "super_admin";
}

// Check if user can access district
export function canAccessDistrict(
  userProfile: UserProfile,
  districtId: string
): boolean {
  // Super admins can access any district
  if (userProfile.role === "super_admin") {
    return true;
  }

  // Other users can only access their own district
  return userProfile.district_id === districtId;
}

// Check if user can manage users
export function canManageUsers(userRole: UserRole): boolean {
  return hasRole(userRole, ["super_admin", "district_admin", "school_admin"]);
}

// Check if user can create assignments
export function canCreateAssignments(userRole: UserRole): boolean {
  return hasRole(userRole, [
    "super_admin",
    "district_admin",
    "school_admin",
    "teacher",
  ]);
}

// Get redirect path based on user role
export function getRedirectPath(userRole: UserRole): string {
  switch (userRole) {
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

// Validate email domain for district (optional feature)
export function validateEmailDomain(
  email: string,
  allowedDomain?: string
): boolean {
  if (!allowedDomain) return true;

  const emailDomain = email.split("@")[1];
  return emailDomain === allowedDomain;
}
