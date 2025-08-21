// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Simplified Middleware
 * Only validates sessions, no redirects or complex logic
 */
export async function middleware(request: NextRequest) {
  // Skip static assets and API routes we don't want to check
  const path = request.nextUrl.pathname;
  
  if (
    path.startsWith("/_next/") ||
    path.startsWith("/favicon.") ||
    path.startsWith("/public/") ||
    path.startsWith("/assets/") ||
    path.endsWith(".png") ||
    path.endsWith(".jpg") ||
    path.endsWith(".svg") ||
    path.endsWith(".ico")
  ) {
    return NextResponse.next();
  }

  // Create response object to pass through
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create Supabase client for middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Only refresh session, don't make auth decisions
  // The actual auth checks happen in server components
  try {
    await supabase.auth.getUser();
  } catch (error) {
    // Silently fail - let server components handle auth
    console.error("Middleware session refresh error:", error);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};