/**
 * Supabase server client — for Server Components and Route Handlers.
 *
 * Calls next/headers cookies() internally so callers don't need to.
 * Returns a typed client using Database from lib/database.types.ts.
 */

import { createServerClient as _createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

export async function createServerClient() {
  const cookieStore = await cookies();

  return _createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          return cookieStore.getAll();
        },
        async setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — safe to ignore when
            // middleware is refreshing user sessions.
          }
        },
      },
    }
  );
}
