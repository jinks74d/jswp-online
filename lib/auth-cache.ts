// lib/auth-cache.ts
"use client";

interface CachedData {
  data: any;
  timestamp: number;
  expiresAt: number;
  version: number; // For cache invalidation
}

import { SecurityConfig } from "./security-config";

// Security-hardened cache durations
const PROFILE_CACHE_DURATION = 3 * 60 * 1000; // Reduced to 3 minutes for security
const SESSION_CACHE_DURATION = 90 * 1000; // Reduced to 90 seconds for security
const AUTH_STATE_DURATION = 60 * 1000; // 1 minute for quick auth checks
const CACHE_VERSION = 2; // Increment to invalidate all caches

const PROFILE_CACHE_KEY = "jswp-profile-cache";
const SESSION_CACHE_KEY = "jswp-session-cache";
const AUTH_STATE_KEY = "jswp-auth-state";

export class AuthCache {
  // Enhanced profile caching with version control
  static setProfile(profile: any): void {
    if (typeof window === "undefined" || !profile) return;

    const cached: CachedData = {
      data: profile,
      timestamp: Date.now(),
      expiresAt: Date.now() + PROFILE_CACHE_DURATION,
      version: CACHE_VERSION,
    };

    try {
      sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cached));
      // Also cache basic auth state for quick access
      this.setAuthState({
        hasUser: true,
        hasProfile: true,
        userEmail: profile.email,
        userRole: profile.role,
      });
    } catch (error) {
      console.warn("Failed to cache profile:", error);
    }
  }

  static getProfile(): any | null {
    if (typeof window === "undefined") return null;

    try {
      const cached = sessionStorage.getItem(PROFILE_CACHE_KEY);
      if (!cached) return null;

      const parsedCache: CachedData = JSON.parse(cached);

      // Check version compatibility
      if (parsedCache.version !== CACHE_VERSION) {
        this.clearProfile();
        return null;
      }

      // Check if cache is expired
      if (Date.now() > parsedCache.expiresAt) {
        this.clearProfile();
        return null;
      }

      return parsedCache.data;
    } catch (error) {
      console.warn("Failed to get cached profile:", error);
      this.clearProfile();
      return null;
    }
  }

  static clearProfile(): void {
    if (typeof window === "undefined") return;

    try {
      sessionStorage.removeItem(PROFILE_CACHE_KEY);
    } catch (error) {
      console.warn("Failed to clear profile cache:", error);
    }
  }

  static setSession(session: any): void {
    if (typeof window === "undefined" || !session) return;

    const cached: CachedData = {
      data: session,
      timestamp: Date.now(),
      expiresAt: Date.now() + SESSION_CACHE_DURATION,
      version: CACHE_VERSION,
    };

    try {
      sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(cached));
    } catch (error) {
      console.warn("Failed to cache session:", error);
    }
  }

  static getSession(): any | null {
    if (typeof window === "undefined") return null;

    try {
      const cached = sessionStorage.getItem(SESSION_CACHE_KEY);
      if (!cached) return null;

      const parsedCache: CachedData = JSON.parse(cached);

      // Check version compatibility
      if (parsedCache.version !== CACHE_VERSION) {
        this.clearSession();
        return null;
      }

      // Check if cache is expired
      if (Date.now() > parsedCache.expiresAt) {
        this.clearSession();
        return null;
      }

      return parsedCache.data;
    } catch (error) {
      console.warn("Failed to get cached session:", error);
      this.clearSession();
      return null;
    }
  }

  static clearSession(): void {
    if (typeof window === "undefined") return;

    try {
      sessionStorage.removeItem(SESSION_CACHE_KEY);
    } catch (error) {
      console.warn("Failed to clear session cache:", error);
    }
  }

  // Enhanced auth state caching with security
  static setAuthState(state: {
    hasUser: boolean;
    hasProfile: boolean;
    userEmail?: string;
    userRole?: string;
  }): void {
    if (typeof window === "undefined") return;

    try {
      const secureState = {
        ...state,
        timestamp: Date.now(),
        expiresAt: Date.now() + AUTH_STATE_DURATION,
        version: CACHE_VERSION,
        // Add basic integrity check
        checksum: btoa(JSON.stringify(state)).slice(0, 8),
      };

      sessionStorage.setItem(AUTH_STATE_KEY, JSON.stringify(secureState));
    } catch (error) {
      console.warn("Failed to cache auth state:", error);
    }
  }

  static getAuthState(): {
    hasUser: boolean;
    hasProfile: boolean;
    userEmail?: string;
    userRole?: string;
  } | null {
    if (typeof window === "undefined") return null;

    try {
      const cached = sessionStorage.getItem(AUTH_STATE_KEY);
      if (!cached) return null;

      const state = JSON.parse(cached);

      // Check version compatibility
      if (state.version !== CACHE_VERSION) {
        this.clearAuthState();
        return null;
      }

      // Check expiration
      if (Date.now() > state.expiresAt) {
        this.clearAuthState();
        return null;
      }

      // Verify integrity
      const expectedChecksum = btoa(
        JSON.stringify({
          hasUser: state.hasUser,
          hasProfile: state.hasProfile,
          userEmail: state.userEmail,
          userRole: state.userRole,
        })
      ).slice(0, 8);

      if (state.checksum !== expectedChecksum) {
        console.warn("AuthCache: Auth state integrity check failed");
        this.clearAuthState();
        return null;
      }

      return {
        hasUser: state.hasUser,
        hasProfile: state.hasProfile,
        userEmail: state.userEmail,
        userRole: state.userRole,
      };
    } catch (error) {
      console.warn("Failed to get cached auth state:", error);
      return null;
    }
  }

  static clearAuthState(): void {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.removeItem(AUTH_STATE_KEY);
    } catch (error) {
      console.warn("Failed to clear auth state:", error);
    }
  }

  static clearAll(): void {
    this.clearProfile();
    this.clearSession();
    this.clearAuthState();
  }

  static isProfileCacheValid(): boolean {
    if (typeof window === "undefined") return false;

    try {
      const cached = sessionStorage.getItem(PROFILE_CACHE_KEY);
      if (!cached) return false;

      const parsedCache: CachedData = JSON.parse(cached);
      return (
        parsedCache.version === CACHE_VERSION &&
        Date.now() <= parsedCache.expiresAt
      );
    } catch (error) {
      return false;
    }
  }

  // New: Check if we have any valid cached auth data
  static hasValidAuthData(): boolean {
    return this.isProfileCacheValid() || this.getAuthState() !== null;
  }

  // Security: Force cache cleanup
  static secureCleanup(): void {
    if (typeof window === "undefined") return;

    try {
      // Clear all JSWP-related storage
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("jswp-") || key.startsWith("sb-")) {
          sessionStorage.removeItem(key);
        }
      });

      // Also clear localStorage for Supabase auth
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("sb-")) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn("Failed to perform secure cleanup:", error);
    }
  }

  // Security: Validate cache integrity
  static validateCacheIntegrity(): boolean {
    try {
      const profile = this.getProfile();
      const session = this.getSession();
      const authState = this.getAuthState();

      // Basic consistency checks with null guards
      if (profile && authState && typeof profile === 'object' && typeof authState === 'object') {
        return (
          profile.email === authState.userEmail &&
          profile.role === authState.userRole
        );
      }

      return true; // No data to validate
    } catch (error) {
      console.warn("Cache integrity validation failed:", error);
      return false;
    }
  }

  // Security: Get cache statistics for monitoring
  static getCacheStats(): {
    profileCached: boolean;
    sessionCached: boolean;
    authStateCached: boolean;
    totalSize: number;
  } {
    if (typeof window === "undefined") {
      return {
        profileCached: false,
        sessionCached: false,
        authStateCached: false,
        totalSize: 0,
      };
    }

    let totalSize = 0;
    const profileCached = !!sessionStorage.getItem(PROFILE_CACHE_KEY);
    const sessionCached = !!sessionStorage.getItem(SESSION_CACHE_KEY);
    const authStateCached = !!sessionStorage.getItem(AUTH_STATE_KEY);

    // Calculate approximate storage size with null guard
    try {
      Object.keys(sessionStorage || {}).forEach((key) => {
        if (key && key.startsWith("jswp-")) {
          const item = sessionStorage.getItem(key);
          totalSize += (item || "").length;
        }
      });
    } catch (error) {
      console.warn("Failed to calculate cache size:", error);
    }

    return {
      profileCached,
      sessionCached,
      authStateCached,
      totalSize,
    };
  }
}
