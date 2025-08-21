// lib/security-config.ts
"use client";

export const SecurityConfig = {
  // Session timeouts (in milliseconds)
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes of inactivity
  SESSION_WARNING: 5 * 60 * 1000, // Warn 5 minutes before timeout
  SESSION_EXTENSION: 15 * 60 * 1000, // Extend session by 15 minutes

  // Network recovery timeouts
  NETWORK_GRACE_PERIOD: 30 * 1000, // 30 seconds (reduced from 5 minutes)
  NETWORK_RETRY_ATTEMPTS: 3,
  NETWORK_RETRY_DELAY: 5 * 1000, // 5 seconds between retries

  // Cache security
  MAX_CACHE_AGE: 10 * 60 * 1000, // 10 minutes max cache age
  CACHE_CLEANUP_INTERVAL: 5 * 60 * 1000, // Clean cache every 5 minutes

  // Cross-tab security
  CROSS_TAB_SYNC_INTERVAL: 30 * 1000, // Sync auth state every 30 seconds
  LOGOUT_BROADCAST_TIMEOUT: 2 * 1000, // 2 seconds to broadcast logout

  // Session validation
  SESSION_VALIDATION_INTERVAL: 5 * 60 * 1000, // Validate session every 5 minutes
  TOKEN_REFRESH_THRESHOLD: 10 * 60 * 1000, // Refresh token 10 minutes before expiry

  // Security headers and flags
  SECURE_STORAGE_PREFIX: "jswp-secure-",
  SESSION_FINGERPRINT_KEY: "jswp-session-fp",

  // Rate limiting
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes lockout

  // Development vs Production settings
  isDevelopment: process.env.NODE_ENV === "development",

  // Get timeout based on environment
  getSessionTimeout(): number {
    return this.isDevelopment ? 60 * 60 * 1000 : this.SESSION_TIMEOUT; // 1 hour in dev, 30 min in prod
  },

  // Get network grace period based on environment
  getNetworkGracePeriod(): number {
    return this.isDevelopment ? 60 * 1000 : this.NETWORK_GRACE_PERIOD; // 1 minute in dev, 30 seconds in prod
  },
} as const;
