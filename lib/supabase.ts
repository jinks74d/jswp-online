// lib/supabase.ts
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

// Database type placeholder
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfile;
        Insert: Partial<UserProfile>;
        Update: Partial<UserProfile>;
      };
      [key: string]: any;
    };
  };
}

// Types for our database
export type UserRole =
  | "super_admin"
  | "district_admin"
  | "school_admin"
  | "teacher"
  | "student";

export interface UserProfile {
  id: string;
  district_id: string | null;
  school_id: string | null;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  email: string;
  metadata: Record<string, any> | null;
  created_at: string | null;
  updated_at: string | null;
  // Optional expanded relations
  districts?: District;
  schools?: School;
}

export interface District {
  id: string;
  name: string;
  domain: string | null;
  poc_email: string;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface School {
  id: string;
  district_id: string;
  name: string;
  address: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// PERFORMANCE: Singleton client instance for browser
let browserClient: SupabaseClient<Database> | null = null;

// Browser client for client components - optimized singleton pattern
export function createClient(): SupabaseClient<Database> {
  // Handle server-side rendering gracefully
  if (typeof window === "undefined") {
    // Return a new client for each SSR request (no shared state)
    return createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  // Return existing singleton for browser
  if (browserClient) {
    return browserClient;
  }

  // Validate environment variables
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    console.error("Supabase: Missing environment variables");
    throw new Error("Missing Supabase environment variables");
  }

  // Create singleton browser client with proper storage
  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // Prevent URL parsing issues
        flowType: "pkce",
        debug: false,
        storage:
          typeof window !== "undefined" ? window.localStorage : undefined,
        // Use default Supabase naming for consistency
        // This will create: sb-{project-ref}-auth-token in both localStorage and cookies
      },
      global: {
        headers: {
          "X-Client-Info": "jswp-web-client",
        },
      },
    }
  );

  return browserClient;
}

// Server client for server components and API routes
export async function createServerSupabaseClient(cookieStore: any) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          return cookieStore.getAll();
        },
        async setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: CookieOptions;
          }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

// Middleware client with proper cookie handling
export function createMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookies = request.cookies.getAll();
          return cookies;
        },
        setAll(cookiesToSet) {
          // Update request cookies
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          // Create new response with updated cookies
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });

          // Set cookies on response
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              httpOnly: false, // Allow client-side access
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
            });
          });
        },
      },
    }
  );

  return { supabase, response };
}
