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
    if (redirectCount > 2) {  // Reduced from 3 to 2 for faster detection
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
    const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));
    
    if (!isProtectedRoute) {
      return response;
    }

    // PERFORMANCE: Optimized session check with shorter timeout
    let session = null;
    let user = null;

    try {
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Session timeout")), 2000) // Reduced from 5000ms
      );

      const result = await Promise.race([sessionPromise, timeoutPromise]);
      const sessionData = (result as any).data?.session;
      const sessionError = (result as any).error;

      if (sessionError) {
        console.warn("Middleware: Session error, allowing client to handle");
        return response; // Let client handle auth
      }

      session = sessionData;
      user = session?.user;
      
      if (user) {
        console.log("Middleware: User found:", user.email, "for path:", path);
      }
    } catch (error) {
      console.warn("Middleware: Session check failed, deferring to client");
      return response; // Let client handle auth
    }

    // PERFORMANCE: If no user, let client handle the redirect
    if (!user) {
      console.log("Middleware: No user found for protected route:", path);
      // For dashboard routes without a user, let the client-side handle it
      // to prevent redirect loops
      return response;
    }

    // PERFORMANCE: Simplified profile check without memory-leaking cache
    let profile = null;

    try {
      // Fetch profile with optimized query and timeout
      const profilePromise = supabase
        .from("user_profiles")
        .select("role, district_id") // Only fetch what we need
        .eq("id", user.id)
        .maybeSingle(); // Use maybeSingle to avoid errors on missing records

      const profileTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Profile timeout")), 1000) // Reduced timeout
      );

      const result = await Promise.race([profilePromise, profileTimeoutPromise]);
      const profileData = (result as any).data;
      const profileError = (result as any).error;

      if (profileError || !profileData) {
        console.warn("Middleware: Profile fetch failed, deferring to client");
        return response;
      }

      profile = profileData;
    } catch (error) {
      console.warn("Middleware: Profile fetch failed, deferring to client");
      return response;
    }

    // PERFORMANCE: Fast role-based redirects
    if (profile) {
      const isSuperAdminRoute = path.startsWith("/super-admin");
      const isDashboardRoute = path.startsWith("/dashboard");
      const isSuperAdmin = profile.role === "super_admin";
      const hasRedirectHeader = request.headers.get("x-middleware-redirect");

      // Only redirect if there's a role mismatch and no redirect header
      if (!hasRedirectHeader) {
        if (isSuperAdminRoute && !isSuperAdmin) {
          const redirectResponse = NextResponse.redirect(new URL("/dashboard", request.url));
          redirectResponse.headers.set("x-middleware-redirect", "dashboard");
          redirectResponse.headers.set("x-redirect-count", (redirectCount + 1).toString());
          return redirectResponse;
        }

        if (isDashboardRoute && isSuperAdmin) {
          const redirectResponse = NextResponse.redirect(new URL("/super-admin", request.url));
          redirectResponse.headers.set("x-middleware-redirect", "super-admin");
          redirectResponse.headers.set("x-redirect-count", (redirectCount + 1).toString());
          return redirectResponse;
        }
      }

      // Add optimized headers for API routes
      if (path.startsWith("/api/")) {
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set("x-user-id", user.id);
        requestHeaders.set("x-user-role", profile.role);
        if (profile.district_id) {
          requestHeaders.set("x-user-district-id", profile.district_id);
        }
        return NextResponse.next({ request: { headers: requestHeaders } });
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
