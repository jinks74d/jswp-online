// lib/auth-cache.ts
"use client";

interface CachedProfile {
  data: any;
  timestamp: number;
  expiresAt: number;
}

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
const PROFILE_CACHE_KEY = "jswp-profile-cache";
const SESSION_CACHE_KEY = "jswp-session-cache";

export class AuthCache {
  static setProfile(profile: any): void {
    if (typeof window === "undefined") return;

    const cached: CachedProfile = {
      data: profile,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_DURATION,
    };

    try {
      sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cached));
    } catch (error) {
      console.warn("Failed to cache profile:", error);
    }
  }

  static getProfile(): any | null {
    if (typeof window === "undefined") return null;

    try {
      const cached = sessionStorage.getItem(PROFILE_CACHE_KEY);
      if (!cached) return null;

      const parsedCache: CachedProfile = JSON.parse(cached);

      // Check if cache is expired
      if (Date.now() > parsedCache.expiresAt) {
        sessionStorage.removeItem(PROFILE_CACHE_KEY);
        return null;
      }

      return parsedCache.data;
    } catch (error) {
      console.warn("Failed to get cached profile:", error);
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
    if (typeof window === "undefined") return;

    const cached: CachedProfile = {
      data: session,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_DURATION / 2, // Shorter cache for session
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

      const parsedCache: CachedProfile = JSON.parse(cached);

      // Check if cache is expired
      if (Date.now() > parsedCache.expiresAt) {
        sessionStorage.removeItem(SESSION_CACHE_KEY);
        return null;
      }

      return parsedCache.data;
    } catch (error) {
      console.warn("Failed to get cached session:", error);
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

  static clearAll(): void {
    this.clearProfile();
    this.clearSession();
  }

  static isProfileCacheValid(): boolean {
    if (typeof window === "undefined") return false;

    try {
      const cached = sessionStorage.getItem(PROFILE_CACHE_KEY);
      if (!cached) return false;

      const parsedCache: CachedProfile = JSON.parse(cached);
      return Date.now() <= parsedCache.expiresAt;
    } catch (error) {
      return false;
    }
  }
}
