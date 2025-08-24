// lib/auth/session.ts
import "server-only";

import { cookies } from "next/headers";
import { getSessionConfig } from "./session-config";

/**
 * Server-side session utilities
 * Handles session cookies and validation
 */
export class SessionManager {
  /**
   * Set session cookie
   */
  static async setSessionCookie(token: string): Promise<void> {
    const cookieStore = await cookies();
    const config = getSessionConfig();
    
    cookieStore.set(config.cookieName, token, {
      httpOnly: config.httpOnly,
      secure: config.secure || process.env.NODE_ENV === "production",
      sameSite: config.sameSite,
      maxAge: config.maxAge,
      path: "/",
    });
  }

  /**
   * Clear session cookie
   */
  static async clearSessionCookie(): Promise<void> {
    const cookieStore = await cookies();
    const config = getSessionConfig();
    
    cookieStore.delete(config.cookieName);
  }

  /**
   * Get session cookie value
   */
  static async getSessionCookie(): Promise<string | undefined> {
    const cookieStore = await cookies();
    const config = getSessionConfig();
    const cookie = cookieStore.get(config.cookieName);
    return cookie?.value;
  }

  /**
   * Check if session needs refresh
   */
  static shouldRefreshSession(issuedAt: number): boolean {
    const age = Date.now() - issuedAt;
    const config = getSessionConfig();
    return age > config.updateAge * 1000;
  }
}