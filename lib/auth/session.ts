// lib/auth/session.ts
import "server-only";

import { cookies } from "next/headers";
import { SESSION_CONFIG } from "./types";

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
    
    cookieStore.set(SESSION_CONFIG.cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_CONFIG.maxAge,
      path: "/",
    });
  }

  /**
   * Clear session cookie
   */
  static async clearSessionCookie(): Promise<void> {
    const cookieStore = await cookies();
    
    cookieStore.delete(SESSION_CONFIG.cookieName);
  }

  /**
   * Get session cookie value
   */
  static async getSessionCookie(): Promise<string | undefined> {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(SESSION_CONFIG.cookieName);
    return cookie?.value;
  }

  /**
   * Check if session needs refresh
   */
  static shouldRefreshSession(issuedAt: number): boolean {
    const age = Date.now() - issuedAt;
    return age > SESSION_CONFIG.updateAge * 1000;
  }
}