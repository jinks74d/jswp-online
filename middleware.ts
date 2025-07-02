// middleware.ts (in root directory)
import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase";

export async function middleware(request: NextRequest) {
  try {
    const { supabase, response } = createMiddlewareClient(request);

    const path = request.nextUrl.pathname;

    // Skip auth checks for signout API route
    if (path === "/api/auth/signout") {
      return response;
    }

    // Refresh session if expired - required for Server Components
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Public routes that don't require authentication
    const publicRoutes = ["/", "/login", "/signup"];

    // If user is not authenticated and trying to access protected route
    if (!user && !publicRoutes.includes(path)) {
      const redirectUrl = new URL("/", request.url);
      return NextResponse.redirect(redirectUrl);
    }

    // If user is authenticated, get their profile for role-based routing
    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role, district_id")
        .eq("id", user.id)
        .single();

      if (profile) {
        // Redirect based on role and current path
        if (path === "/" || path === "/login") {
          // Authenticated user on login page - redirect to appropriate dashboard
          const redirectPath =
            profile.role === "super_admin" ? "/super-admin" : "/dashboard";
          const redirectUrl = new URL(redirectPath, request.url);
          return NextResponse.redirect(redirectUrl);
        }

        // Protect super admin routes
        if (path.startsWith("/super-admin") && profile.role !== "super_admin") {
          const redirectUrl = new URL("/dashboard", request.url);
          return NextResponse.redirect(redirectUrl);
        }

        // Redirect super admin away from regular dashboard
        if (path.startsWith("/dashboard") && profile.role === "super_admin") {
          const redirectUrl = new URL("/super-admin", request.url);
          return NextResponse.redirect(redirectUrl);
        }

        // For API routes, add user context to headers
        if (path.startsWith("/api/")) {
          const requestHeaders = new Headers(request.headers);
          requestHeaders.set("x-user-id", user.id);
          requestHeaders.set("x-user-role", profile.role);
          if (profile.district_id) {
            requestHeaders.set("x-user-district-id", profile.district_id);
          }

          return NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });
        }
      }
    }

    return response;
  } catch (error) {
    // If middleware fails, redirect to login
    console.error("Middleware error:", error);
    const redirectUrl = new URL("/", request.url);
    return NextResponse.redirect(redirectUrl);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
