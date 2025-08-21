// lib/auth/client.ts
"use client";

import { useRouter } from "next/navigation";
import type { AuthState } from "./types";

/**
 * Minimal client-side auth utilities
 * For display purposes only - no auth decisions made here
 */

/**
 * Client-side sign out
 * Calls server action and redirects
 */
export function useSignOut() {
  const router = useRouter();

  const signOut = async () => {
    try {
      const response = await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        router.push("/");
        router.refresh();
      }
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return signOut;
}

/**
 * Format user display name
 */
export function getUserDisplayName(state: AuthState): string {
  if (!state.profile) return "User";
  
  const { first_name, last_name, email } = state.profile;
  
  if (first_name && last_name) {
    return `${first_name} ${last_name}`;
  }
  
  if (first_name) return first_name;
  if (last_name) return last_name;
  
  return email.split("@")[0];
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: string): string {
  const roleMap: Record<string, string> = {
    super_admin: "Super Admin",
    district_admin: "District Admin",
    school_admin: "School Admin",
    teacher: "Teacher",
    student: "Student",
  };
  
  return roleMap[role] || role;
}