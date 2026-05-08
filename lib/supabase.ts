// lib/supabase.ts
// ─────────────────────────────────────────────────────────────────────────
// Backward-compatibility shim. New code should import from:
//   ./supabase/server   — createServerClient()
//   ./supabase/client   — createBrowserClient()
//   ./supabase/middleware — createMiddlewareClient()
//
// This file re-exports legacy names so existing imports keep compiling.
// Will be removed once the codebase fully migrates off the v1 schema.
// ─────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from "@supabase/ssr";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// ─── Legacy Database type ───────────────────────────────────────────────
// The old Database type had `[key: string]: any` on Tables, allowing
// arbitrary table access without errors. We preserve that for legacy code.
// New code should use the strict types from lib/database.types.ts.

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Database {
  public: {
    Tables: {
      // Legacy permissive table map — accepts any table name
      [key: string]: {
        Row: Record<string, any>;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
    };
    Views: Record<string, any>;
    Functions: Record<string, any>;
    Enums: Record<string, any>;
  };
}

// ─── Legacy type aliases ────────────────────────────────────────────────

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

// ─── Browser client (legacy name: createClient) ─────────────────────────

let browserClient: SupabaseClient<Database> | null = null;

export function createClient(): SupabaseClient<Database> {
  if (typeof window === "undefined") {
    return createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  if (browserClient) return browserClient;

  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return browserClient;
}

// ─── Server client (legacy name: createServerSupabaseClient) ────────────

export async function createServerSupabaseClient(cookieStore: any) {
  return createServerClient<Database>(
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
            // setAll called from a Server Component — safe to ignore.
          }
        },
      },
    }
  );
}

// ─── Middleware client (unchanged signature) ────────────────────────────

export function createMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient<Database>(
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
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, { ...options });
          });
        },
      },
    }
  );

  return { supabase, response };
}
