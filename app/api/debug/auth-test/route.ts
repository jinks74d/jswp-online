import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // Log available cookies
    const allCookies = cookieStore.getAll();
    console.log(
      "Available cookies:",
      allCookies.map((c) => ({ name: c.name, hasValue: !!c.value }))
    );

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch (error) {
              console.warn("Failed to set cookies:", error);
            }
          },
        },
      }
    );

    // Test user authentication
    console.log("Testing user authentication...");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    console.log("User result:", {
      hasUser: !!user,
      userEmail: user?.email,
      error: userError?.message,
    });

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          details: {
            userError: (userError as any)?.message,
            hasUser: !!user,
            cookieCount: allCookies.length,
            cookieNames: allCookies.map((c) => c.name),
          },
        },
        { status: 401 }
      );
    }

    // Test profile fetch
    console.log("Testing profile fetch...");
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, role, district_id, school_id, email")
      .eq("id", user.id)
      .single();

    console.log("Profile result:", {
      hasProfile: !!profile,
      role: profile?.role,
      error: profileError?.message,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
      profile: profile
        ? {
            id: profile.id,
            role: profile.role,
            district_id: profile.district_id,
            school_id: profile.school_id,
            email: profile.email,
          }
        : null,
      debug: {
        cookieCount: allCookies.length,
        cookieNames: allCookies.map((c) => c.name),
        userError: (userError as any)?.message,
        profileError: (profileError as any)?.message,
      },
    });
  } catch (error) {
    console.error("Auth test error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
