import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
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
            } catch {
              // The `setAll` method was called from a Server Component.
            }
          },
        },
      }
    );

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile with district/school info
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("district_id, school_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get client info
    const userAgent = request.headers.get("user-agent") || "";
    const clientIP = request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") || 
                     "unknown";

    // Parse browser/device info
    const deviceType = userAgent.toLowerCase().includes("mobile") ? "mobile" : 
                      userAgent.toLowerCase().includes("tablet") ? "tablet" : "desktop";

    // Check for existing active session and end it
    const { error: updateError } = await supabase
      .from("user_sessions")
      .update({
        session_end: new Date().toISOString(),
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (updateError) {
      console.warn("Error ending previous sessions:", updateError);
    }

    // Create new session
    const { data: session, error: sessionError } = await supabase
      .from("user_sessions")
      .insert({
        user_id: user.id,
        district_id: profile.district_id,
        school_id: profile.school_id,
        session_start: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        ip_address: clientIP,
        user_agent: userAgent,
        device_type: deviceType,
        browser_info: {
          userAgent,
          language: request.headers.get("accept-language") || "",
          referrer: request.headers.get("referer") || ""
        },
        is_active: true
      })
      .select("id")
      .single();

    if (sessionError) {
      console.error("Error creating session:", sessionError);
      return NextResponse.json({ 
        error: "Failed to create session",
        details: sessionError.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      sessionId: session.id,
      success: true 
    }, { status: 201 });

  } catch (error) {
    console.error("Error in session start API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}