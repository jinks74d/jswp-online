// middleware.ts (in root directory)
import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase";

export async function middleware(request: NextRequest) {
  try {
    const { supabase, response } = createMiddlewareClient(request);
    const path = request.nextUrl.pathname;

    // Skip auth checks for API routes, static assets, and public files
    if (
      path.startsWith("/api/") ||
      path.startsWith("/_next/") ||
      path.startsWith("/favicon.") ||
      path.startsWith("/public/") ||
      path.startsWith("/assets/") ||
      path.startsWith("/.well-known/")
    ) {
      return response;
    }

    // Public routes that don't require authentication
    const publicRoutes = ["/", "/login", "/signup", "/admin"];

    // CRITICAL FIX: Never redirect from login pages in middleware
    // Let the client-side components handle authentication redirects
    if (publicRoutes.includes(path)) {
      console.log("Middleware: Public route, allowing access:", path);
      return response;
    }

    // Only check authentication for protected routes with more lenient handling
    let session = null;
    let sessionCheckFailed = false;

    try {
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Session timeout")), 1000)
      );

      const result = await Promise.race([sessionPromise, timeoutPromise]);
      session = (result as any).data?.session;

      if ((result as any).error) {
        console.warn("Middleware session error:", (result as any).error);
        sessionCheckFailed = true;
      }
    } catch (error) {
      console.warn("Middleware session check failed:", error);
      sessionCheckFailed = true;
    }

    const user = session?.user;

    // If session check failed or no user, this might be due to timing issues
    // Be more lenient and let the client handle auth, especially for page refreshes
    if (!user || sessionCheckFailed) {
      console.log(
        "Middleware: No user or session check failed for protected route:",
        path
      );

      // For protected routes, be more permissive to avoid redirect loops on refresh
      // The client-side AuthProvider will handle proper authentication checks
      if (path.startsWith("/dashboard") || path.startsWith("/super-admin")) {
        console.log(
          "Middleware: Allowing protected route, client will handle auth"
        );
        return response;
      } else {
        // For other routes, redirect to login
        console.log("Middleware: Redirecting to login");
        return NextResponse.redirect(new URL("/", request.url));
      }
    }

    // User is authenticated - handle role-based routing only
    if (user) {
      // Quick profile check with very short timeout for role-based routing
      let profile = null;
      let profileCheckFailed = false;

      try {
        const profilePromise = supabase
          .from("user_profiles")
          .select("role, district_id")
          .eq("id", user.id)
          .single();

        const profileTimeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Profile timeout")), 1000)
        );

        const result = await Promise.race([
          profilePromise,
          profileTimeoutPromise,
        ]);
        profile = (result as any).data;

        if ((result as any).error) {
          console.warn("Middleware profile error:", (result as any).error);
          profileCheckFailed = true;
        }
      } catch (error) {
        console.warn("Middleware profile timeout:", error);
        profileCheckFailed = true;
      }

      // Only do role-based redirects if we successfully got the profile
      if (profile && !profileCheckFailed) {
        const isSuperAdminRoute = path.startsWith("/super-admin");
        const isDashboardRoute = path.startsWith("/dashboard");
        const isApiRoute = path.startsWith("/api/");
        const isSuperAdmin = profile.role === "super_admin";

        // Handle role-based access control
        if (isSuperAdminRoute && !isSuperAdmin) {
          console.log(
            "Middleware: Non-super-admin accessing super-admin route, redirecting to dashboard"
          );
          return NextResponse.redirect(new URL("/dashboard", request.url));
        }

        if (isDashboardRoute && isSuperAdmin) {
          console.log(
            "Middleware: Super-admin accessing dashboard, redirecting to super-admin"
          );
          return NextResponse.redirect(new URL("/super-admin", request.url));
        }

        // Add user context headers for API routes
        if (isApiRoute) {
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
      } else {
        // Profile check failed - let the layout handle it instead of redirecting
        console.log(
          "Middleware: Profile check failed, allowing request to continue"
        );
      }
    }

    return response;
  } catch (error) {
    console.error("Middleware error:", error);

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

    // Redirect to login for other routes
    return NextResponse.redirect(new URL("/", request.url));
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|public|assets).*)"],
};
