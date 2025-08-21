// lib/session-security.ts
"use client";

import { SecurityConfig } from "./security-config";

interface SessionFingerprint {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  timestamp: number;
}

export class SessionSecurity {
  private static instance: SessionSecurity | null = null;
  private sessionTimer: NodeJS.Timeout | null = null;
  private warningTimer: NodeJS.Timeout | null = null;
  private validationTimer: NodeJS.Timeout | null = null;
  private crossTabTimer: NodeJS.Timeout | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private onSessionExpired: (() => void) | null = null;
  private onSessionWarning: (() => void) | null = null;

  private constructor() {
    this.initializeBroadcastChannel();
  }

  static getInstance(): SessionSecurity {
    if (!this.instance) {
      this.instance = new SessionSecurity();
    }
    return this.instance;
  }

  /**
   * Initialize secure session with fingerprinting
   */
  initializeSession(
    userId: string,
    onExpired: () => void,
    onWarning?: () => void
  ): void {
    this.onSessionExpired = onExpired;
    this.onSessionWarning = onWarning || null;

    // Create session fingerprint for security
    this.createSessionFingerprint(userId);

    // Start session timers
    this.startSessionTimer();
    this.startSessionValidation();
    this.startCrossTabSync();

    console.log("SessionSecurity: Session initialized with security measures");
  }

  /**
   * Create a session fingerprint to detect session hijacking
   */
  private createSessionFingerprint(userId: string): void {
    if (typeof window === "undefined") return;

    try {
      const fingerprint: SessionFingerprint = {
        userAgent: navigator.userAgent,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        timestamp: Date.now(),
      };

      const fingerprintHash = btoa(JSON.stringify(fingerprint));
      sessionStorage.setItem(
        `${SecurityConfig.SESSION_FINGERPRINT_KEY}-${userId}`,
        fingerprintHash
      );
    } catch (error) {
      console.warn(
        "SessionSecurity: Failed to create session fingerprint:",
        error
      );
    }
  }

  /**
   * Validate session fingerprint
   */
  validateSessionFingerprint(userId: string): boolean {
    if (typeof window === "undefined") return true;

    try {
      const storedFingerprint = sessionStorage.getItem(
        `${SecurityConfig.SESSION_FINGERPRINT_KEY}-${userId}`
      );

      if (!storedFingerprint) return false;

      const currentFingerprint: SessionFingerprint = {
        userAgent: navigator.userAgent,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        timestamp: Date.now(),
      };

      const currentHash = btoa(
        JSON.stringify({
          ...currentFingerprint,
          timestamp: 0, // Exclude timestamp from comparison
        })
      );

      const storedData = JSON.parse(atob(storedFingerprint));
      const storedHash = btoa(
        JSON.stringify({
          ...storedData,
          timestamp: 0, // Exclude timestamp from comparison
        })
      );

      return currentHash === storedHash;
    } catch (error) {
      console.warn(
        "SessionSecurity: Failed to validate session fingerprint:",
        error
      );
      return false;
    }
  }

  /**
   * Start session timeout timer
   */
  private startSessionTimer(): void {
    this.clearSessionTimer();

    const sessionTimeout = SecurityConfig.getSessionTimeout();
    const warningTime = sessionTimeout - SecurityConfig.SESSION_WARNING;

    // Set warning timer
    if (this.onSessionWarning) {
      this.warningTimer = setTimeout(() => {
        console.log("SessionSecurity: Session warning triggered");
        this.onSessionWarning?.();
      }, warningTime);
    }

    // Set session expiry timer
    this.sessionTimer = setTimeout(() => {
      console.log("SessionSecurity: Session expired due to inactivity");
      this.handleSessionExpiry();
    }, sessionTimeout);
  }

  /**
   * Reset session timer on user activity
   */
  resetSessionTimer(): void {
    if (this.sessionTimer || this.warningTimer) {
      this.startSessionTimer();
    }
  }

  /**
   * Start periodic session validation
   */
  private startSessionValidation(): void {
    this.validationTimer = setInterval(() => {
      this.validateCurrentSession();
    }, SecurityConfig.SESSION_VALIDATION_INTERVAL);
  }

  /**
   * Validate current session integrity
   */
  private validateCurrentSession(): void {
    // This would typically validate with the server
    // For now, we'll do basic client-side checks
    console.log("SessionSecurity: Performing session validation");

    // Check if session storage is intact
    const hasAuthData = sessionStorage.getItem("jswp-profile-cache") !== null;
    if (!hasAuthData) {
      console.warn("SessionSecurity: Session data missing, triggering logout");
      this.handleSessionExpiry();
    }
  }

  /**
   * Initialize cross-tab communication
   */
  private initializeBroadcastChannel(): void {
    if (typeof window === "undefined" || !window.BroadcastChannel) return;

    this.broadcastChannel = new BroadcastChannel("jswp-security");

    this.broadcastChannel.addEventListener("message", (event) => {
      const { type, data } = event.data;

      switch (type) {
        case "SECURITY_LOGOUT":
          console.log(
            "SessionSecurity: Security logout received from another tab"
          );
          this.handleSessionExpiry();
          break;
        case "SESSION_ACTIVITY":
          // Reset timer when activity detected in other tabs
          this.resetSessionTimer();
          break;
        case "SESSION_VALIDATION_FAILED":
          console.warn(
            "SessionSecurity: Session validation failed in another tab"
          );
          this.handleSessionExpiry();
          break;
      }
    });
  }

  /**
   * Start cross-tab synchronization
   */
  private startCrossTabSync(): void {
    this.crossTabTimer = setInterval(() => {
      this.broadcastSessionActivity();
    }, SecurityConfig.CROSS_TAB_SYNC_INTERVAL);
  }

  /**
   * Broadcast session activity to other tabs
   */
  broadcastSessionActivity(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: "SESSION_ACTIVITY",
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Broadcast security logout to all tabs
   */
  broadcastSecurityLogout(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: "SECURITY_LOGOUT",
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle session expiry
   */
  private handleSessionExpiry(): void {
    this.cleanup();
    this.onSessionExpired?.();
  }

  /**
   * Extend session (called when user chooses to continue)
   */
  extendSession(): void {
    console.log("SessionSecurity: Session extended by user");
    this.startSessionTimer();
    this.broadcastSessionActivity();
  }

  /**
   * Clear all timers
   */
  private clearSessionTimer(): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    this.clearSessionTimer();

    if (this.validationTimer) {
      clearInterval(this.validationTimer);
      this.validationTimer = null;
    }

    if (this.crossTabTimer) {
      clearInterval(this.crossTabTimer);
      this.crossTabTimer = null;
    }

    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    // Clear session fingerprints
    if (typeof window !== "undefined") {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith(SecurityConfig.SESSION_FINGERPRINT_KEY)) {
          sessionStorage.removeItem(key);
        }
      });
    }
  }

  /**
   * Destroy singleton instance
   */
  static destroy(): void {
    if (this.instance) {
      this.instance.cleanup();
      this.instance = null;
    }
  }
}
