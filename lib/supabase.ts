// lib/supabase.ts
import { createBrowserClient } from "@supabase/ssr";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

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

// Global client instance with proper singleton pattern
let browserClient: ReturnType<typeof createBrowserClient> | null = null;
let clientInitialized = false;

// Browser client for client components - robust singleton pattern
export function createClient() {
  // Handle server-side rendering gracefully
  if (typeof window === "undefined") {
    console.log("Supabase: SSR context, returning minimal client");
    // Return a minimal client for SSR that won't cause errors
    return {
      auth: {
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: () => {} } },
        }),
        getSession: () =>
          Promise.resolve({ data: { session: null }, error: null }),
        signOut: () => Promise.resolve({ error: null }),
        signInWithPassword: () =>
          Promise.resolve({ data: null, error: new Error("SSR context") }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: null,
                error: { message: "SSR context", code: "SSR" },
              }),
          }),
        }),
      }),
    } as any;
  }

  // Return existing client if already initialized
  if (clientInitialized && browserClient) {
    return browserClient;
  }

  // Validate environment variables
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    console.error("Missing Supabase environment variables");
    throw new Error("Missing Supabase environment variables");
  }

  console.log("Supabase: Creating new browser client instance");

  try {
    // Create new client instance
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false, // Prevent URL parsing issues
          flowType: "pkce",
          debug: false,
          storage:
            typeof window !== "undefined" ? window.localStorage : undefined,
          storageKey: "sb-auth-token",
        },
        global: {
          headers: {
            "X-Client-Info": "jswp-web-client",
          },
        },
      }
    );

    clientInitialized = true;
    console.log("Supabase: Browser client created successfully");
    return browserClient;
  } catch (error) {
    console.error("Supabase: Failed to create browser client:", error);
    clientInitialized = false;
    browserClient = null;
    throw error;
  }
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

// Middleware client
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
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  return { supabase, response };
}
