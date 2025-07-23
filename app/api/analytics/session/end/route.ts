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

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      // End all active sessions for this user if no specific session ID
      const { error: endAllError } = await supabase
        .from("user_sessions")
        .update({
          session_end: new Date().toISOString(),
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (endAllError) {
        console.error("Error ending all user sessions:", endAllError);
        return NextResponse.json({ 
          error: "Failed to end sessions",
          details: endAllError.message 
        }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "All sessions ended" }, { status: 200 });
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from("user_sessions")
      .select("id, user_id, session_start, is_active")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (!session.is_active) {
      return NextResponse.json({ 
        success: true, 
        message: "Session already ended" 
      }, { status: 200 });
    }

    // Calculate session duration
    const sessionEnd = new Date();
    const sessionStart = new Date(session.session_start);
    const durationMinutes = Math.round((sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60));

    // Update session with end time and duration
    const { error: updateError } = await supabase
      .from("user_sessions")
      .update({
        session_end: sessionEnd.toISOString(),
        duration_minutes: Math.max(1, durationMinutes), // Minimum 1 minute
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq("id", sessionId);

    if (updateError) {
      console.error("Error ending session:", updateError);
      return NextResponse.json({ 
        error: "Failed to end session",
        details: updateError.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      duration: durationMinutes,
      message: "Session ended successfully"
    }, { status: 200 });

  } catch (error) {
    console.error("Error in session end API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}