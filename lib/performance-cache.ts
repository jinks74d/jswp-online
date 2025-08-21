// lib/performance-cache.ts
"use client";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface SessionCache {
  session: any;
  profile: any;
  authState: any;
  lastVerified: number;
}

class PerformanceCache {
  private cache = new Map<string, CacheEntry<any>>();
  private sessionCache: SessionCache | null = null;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly SESSION_TTL = 15 * 60 * 1000; // 15 minutes

  // Generic cache methods
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.sessionCache = null;
  }

  // Session-specific caching
  setSession(session: any, profile: any): void {
    this.sessionCache = {
      session,
      profile,
      authState: {
        hasUser: !!session?.user,
        hasProfile: !!profile,
        userEmail: profile?.email,
        userRole: profile?.role,
      },
      lastVerified: Date.now(),
    };
  }

  getSession(): SessionCache | null {
    if (!this.sessionCache) return null;

    const now = Date.now();
    if (now - this.sessionCache.lastVerified > this.SESSION_TTL) {
      this.sessionCache = null;
      return null;
    }

    return this.sessionCache;
  }

  isSessionValid(): boolean {
    const cached = this.getSession();
    return cached !== null && cached.session && cached.profile;
  }

  // Database query result caching
  setQueryResult(query: string, params: any[], result: any, ttl?: number): void {
    const key = this.getQueryKey(query, params);
    this.set(key, result, ttl);
  }

  getQueryResult(query: string, params: any[]): any {
    const key = this.getQueryKey(query, params);
    return this.get(key);
  }

  private getQueryKey(query: string, params: any[]): string {
    return `query:${query}:${JSON.stringify(params)}`;
  }

  // Profile-specific caching
  setProfile(userId: string, profile: any): void {
    this.set(`profile:${userId}`, profile, this.SESSION_TTL);
    if (this.sessionCache) {
      this.sessionCache.profile = profile;
      this.sessionCache.authState = {
        hasUser: !!this.sessionCache.session?.user,
        hasProfile: !!profile,
        userEmail: profile?.email,
        userRole: profile?.role,
      };
    }
  }

  getProfile(userId: string): any {
    return this.get(`profile:${userId}`);
  }

  // Dashboard data caching
  setDashboardData(userId: string, role: string, data: any): void {
    const key = `dashboard:${userId}:${role}`;
    this.set(key, data, 2 * 60 * 1000); // 2 minutes for dashboard data
  }

  getDashboardData(userId: string, role: string): any {
    const key = `dashboard:${userId}:${role}`;
    return this.get(key);
  }

  // Memory cleanup
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache stats for debugging
  getStats(): {
    size: number;
    sessionCached: boolean;
    oldestEntry: number;
    newestEntry: number;
  } {
    const now = Date.now();
    let oldest = now;
    let newest = 0;

    for (const entry of this.cache.values()) {
      if (entry.timestamp < oldest) oldest = entry.timestamp;
      if (entry.timestamp > newest) newest = entry.timestamp;
    }

    return {
      size: this.cache.size,
      sessionCached: !!this.sessionCache,
      oldestEntry: now - oldest,
      newestEntry: now - newest,
    };
  }
}

// Singleton instance
const performanceCache = new PerformanceCache();

// Auto-cleanup every 5 minutes
if (typeof window !== "undefined") {
  setInterval(() => {
    performanceCache.cleanup();
  }, 5 * 60 * 1000);
}

export default performanceCache;