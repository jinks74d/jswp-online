// middleware.ts (in root directory)
import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase";

export async function middleware(request: NextRequest) {
  try {
    const { supabase, response } = createMiddlewareClient(request);
    const path = request.nextUrl.pathname;

    // PERFORMANCE: Early exit for static assets and API routes
    if (
      path.startsWith("/_next/") ||
      path.startsWith("/api/") || // Skip middleware for API routes
      path.startsWith("/favicon.") ||
      path.startsWith("/public/") ||
      path.startsWith("/assets/") ||
      path.startsWith("/.well-known/") ||
      path.endsWith(".ico") ||
      path.endsWith(".png") ||
      path.endsWith(".jpg") ||
      path.endsWith(".jpeg") ||
      path.endsWith(".gif") ||
      path.endsWith(".svg")
    ) {
      return response;
    }

    // PERFORMANCE: Redirect loop detection with early exit
    const redirectCount = parseInt(
      request.headers.get("x-redirect-count") || "0"
    );
    if (redirectCount > 2) {
      // Reduced from 3 to 2 for faster detection
      console.warn("Middleware: Too many redirects detected, allowing request");
      return response;
    }

    // Public routes that don't require authentication
    const publicRoutes = ["/", "/login", "/signup", "/admin"];

    // PERFORMANCE: Early exit for public routes
    if (publicRoutes.includes(path)) {
      return response;
    }

    // PERFORMANCE: Skip expensive auth checks for non-critical routes
    const protectedRoutes = ["/dashboard", "/super-admin"];
    const isProtectedRoute = protectedRoutes.some((route) =>
      path.startsWith(route)
    );

    if (!isProtectedRoute) {
      return response;
    }

    // ROBUST: Improved auth check with proper error handling
    let user = null;

    try {
      const userPromise = supabase.auth.getUser();
      const timeoutPromise = new Promise(
        (_, reject) =>
          setTimeout(() => reject(new Error("User auth timeout")), 3000) // 3 second timeout
      );

      const result = await Promise.race([userPromise, timeoutPromise]);
      const userData = (result as any).data?.user;
      const userError = (result as any).error;

      if (userError) {
        // Don't redirect on auth errors - let client handle
        return response;
      }

      user = userData;

      if (!user) {
        // For super-admin routes, redirect to home
        if (path.startsWith("/super-admin")) {
          return NextResponse.redirect(new URL("/", request.url));
        }
        // For dashboard routes, redirect to home
        if (path.startsWith("/dashboard")) {
          return NextResponse.redirect(new URL("/", request.url));
        }
      }
    } catch (error) {
      console.log("Middleware: Auth check failed:", (error as Error).message);
      // On timeout or error, let the request through - client will handle
      return response;
    }

    // Handle API route headers if we can get session data quickly
    if (path.startsWith("/api/")) {
      try {
        const userPromise = supabase.auth.getUser();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("User auth timeout")), 1000)
        );

        const result = await Promise.race([userPromise, timeoutPromise]);
        const userData = (result as any).data?.user;
        const user = userData;

        if (user) {
          // Try to get profile quickly for API headers
          try {
            const { data: profile } = await supabase
              .from("user_profiles")
              .select("role, district_id")
              .eq("id", user.id)
              .maybeSingle()
              .then((res: any) => ({ data: res.data }));

            if (profile) {
              const requestHeaders = new Headers(request.headers);
              requestHeaders.set("x-user-id", user.id);
              requestHeaders.set("x-user-role", profile.role);
              if (profile.district_id) {
                requestHeaders.set("x-user-district-id", profile.district_id);
              }
              return NextResponse.next({
                request: { headers: requestHeaders },
              });
            }
          } catch (profileError) {
            // Ignore profile errors for API routes
          }
        }
      } catch (sessionError) {
        // Ignore session errors for API routes
      }
    }

    return response;
  } catch (error) {
    console.error("Middleware error:", error);

    // FIXED: Better error handling with network resilience
    const isNetworkError =
      error instanceof Error &&
      (error.message.includes("fetch") ||
        error.message.includes("network") ||
        error.message.includes("timeout"));

    // For network errors, be more lenient and allow the request to continue
    if (isNetworkError) {
      console.warn(
        "Middleware: Network error detected, allowing request to continue"
      );
      return NextResponse.next();
    }

    // For API routes, return error response instead of redirect
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Only redirect to login for non-protected routes to avoid loops
    const protectedRoutes = ["/dashboard", "/super-admin"];
    const isProtectedRoute = protectedRoutes.some((route) =>
      request.nextUrl.pathname.startsWith(route)
    );

    if (isProtectedRoute) {
      console.warn(
        "Middleware: Error on protected route, allowing client to handle"
      );
      return NextResponse.next();
    }

    // Redirect to login for other routes
    return NextResponse.redirect(new URL("/", request.url));
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|public|assets).*)"],
};
