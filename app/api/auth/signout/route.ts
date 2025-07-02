import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    
    // Create Supabase client
    const supabase = createServerClient(
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
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Supabase signout error:", error);
      return NextResponse.json(
        { error: "Failed to sign out" },
        { status: 500 }
      );
    }

    // Create response
    const response = NextResponse.json(
      { message: "Successfully signed out" },
      { status: 200 }
    );

    // Clear all Supabase-related cookies explicitly
    const allCookies = cookieStore.getAll();
    allCookies.forEach((cookie) => {
      if (
        cookie.name.startsWith("sb-") ||
        cookie.name.includes("supabase") ||
        cookie.name.includes("auth")
      ) {
        response.cookies.set(cookie.name, "", {
          expires: new Date(0),
          path: "/",
          domain: undefined,
          secure: process.env.NODE_ENV === "production",
          httpOnly: true,
          sameSite: "lax",
        });
      }
    });

    // Also clear common auth cookie names
    const authCookieNames = [
      "sb-access-token",
      "sb-refresh-token",
      "supabase-auth-token",
      "auth-token",
    ];

    authCookieNames.forEach((cookieName) => {
      response.cookies.set(cookieName, "", {
        expires: new Date(0),
        path: "/",
        domain: undefined,
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
      });
    });

    return response;
  } catch (error) {
    console.error("Signout API error:", error);
    return NextResponse.json(
      { error: "Internal server error during signout" },
      { status: 500 }
    );
  }
}
