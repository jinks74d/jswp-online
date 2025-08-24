// lib/auth/session-config.ts
import "server-only";

/**
 * Session configuration that reads from environment variables
 * This is a server-only module to ensure proper env var access
 */

// Session configuration with environment variable support
// Using lazy evaluation to avoid issues during build
export function getSessionConfig() {
  // Only access env vars when function is called, not at module load
  const maxAge = process.env.SESSION_MAX_AGE 
    ? parseInt(process.env.SESSION_MAX_AGE, 10) 
    : 60 * 60 * 24; // Default: 24 hours
    
  const updateAge = process.env.SESSION_UPDATE_AGE
    ? parseInt(process.env.SESSION_UPDATE_AGE, 10)
    : 60 * 15; // Default: 15 minutes
    
  return {
    maxAge: maxAge > 0 ? maxAge : 60 * 60 * 24,
    updateAge: updateAge > 0 ? updateAge : 60 * 15,
    cookieName: process.env.SESSION_COOKIE_NAME || "jswp-session",
    secure: process.env.SESSION_COOKIE_SECURE === "true",
    httpOnly: process.env.SESSION_COOKIE_HTTPONLY !== "false", // Default: true
    sameSite: (process.env.SESSION_COOKIE_SAMESITE as "strict" | "lax" | "none") || "lax",
  };
}