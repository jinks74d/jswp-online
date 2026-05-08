/**
 * Supabase middleware client — for middleware.ts only.
 *
 * Reads cookies from the request, refreshes the session, and writes
 * updated cookies to the response. Returns both the client and the
 * response (which must be returned from the middleware handler).
 */

import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";

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
          // Update request cookies so downstream handlers see them
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          // Rebuild response with the updated request headers
          response = NextResponse.next({
            request: { headers: request.headers },
          });

          // Set cookies on the outgoing response
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              // Let @supabase/ssr control httpOnly/secure/sameSite via
              // the options it passes. Don't override with httpOnly: false.
            });
          });
        },
      },
    }
  );

  return { supabase, response };
}
