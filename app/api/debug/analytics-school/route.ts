import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
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

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select(
        `
        id, role, district_id, school_id, email,
        districts:district_id(id, name),
        schools:school_id(id, name)
      `
      )
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Check if user_sessions table exists and has data
    const { data: allSessions, error: allSessionsError } = await supabase
      .from("user_sessions")
      .select("*")
      .limit(10);

    // Check sessions for this user
    const { data: userSessions, error: userSessionsError } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("session_start", { ascending: false })
      .limit(5);

    // Check sessions for this school
    const { data: schoolSessions, error: schoolSessionsError } = await supabase
      .from("user_sessions")
      .select(
        `
        id, user_id, session_start, session_end, duration_minutes, is_active,
        user_profiles!user_sessions_user_id_fkey(email, role)
      `
      )
      .eq("school_id", profile.school_id)
      .order("session_start", { ascending: false })
      .limit(10);

    // Check active sessions
    const { data: activeSessions, error: activeSessionsError } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("is_active", true)
      .eq("school_id", profile.school_id);

    // Test analytics query that the dashboard uses
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const { data: analyticsData, error: analyticsError } = await supabase
      .from("user_sessions")
      .select(
        `
        id,
        user_id,
        district_id,
        school_id,
        session_start,
        session_end,
        duration_minutes,
        pages_visited,
        actions_count,
        device_type,
        user_profiles!user_sessions_user_id_fkey(role, first_name, last_name),
        schools!user_sessions_school_id_fkey(id, name)
      `
      )
      .gte("session_start", startDate.toISOString())
      .lte("session_start", endDate.toISOString())
      .eq("district_id", profile.district_id)
      .eq("school_id", profile.school_id)
      .order("session_start", { ascending: false })
      .limit(50);

    return NextResponse.json({
      debug: {
        user: {
          id: user.id,
          email: user.email,
        },
        profile: {
          id: profile.id,
          role: profile.role,
          district_id: profile.district_id,
          school_id: profile.school_id,
          district_name: (profile.districts as any)?.name,
          school_name: (profile.schools as any)?.name,
        },
        sessionCounts: {
          allSessions: allSessions?.length || 0,
          userSessions: userSessions?.length || 0,
          schoolSessions: schoolSessions?.length || 0,
          activeSessions: activeSessions?.length || 0,
          analyticsData: analyticsData?.length || 0,
        },
        errors: {
          allSessionsError: allSessionsError?.message,
          userSessionsError: userSessionsError?.message,
          schoolSessionsError: schoolSessionsError?.message,
          activeSessionsError: activeSessionsError?.message,
          analyticsError: analyticsError?.message,
        },
        sampleData: {
          userSessions: userSessions?.slice(0, 2),
          schoolSessions: schoolSessions?.slice(0, 3),
          activeSessions: activeSessions?.slice(0, 2),
          analyticsData: analyticsData?.slice(0, 3),
        },
      },
    });
  } catch (error) {
    console.error("Debug analytics error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error },
      { status: 500 }
    );
  }
}
