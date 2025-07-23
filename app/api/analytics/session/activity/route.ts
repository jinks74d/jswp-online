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
    const { sessionId, path, pageTitle, actionType, actionDetails, assignmentId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    // Verify session belongs to user and is active
    const { data: session, error: sessionError } = await supabase
      .from("user_sessions")
      .select("id, user_id, district_id, school_id, is_active")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Invalid or inactive session" }, { status: 400 });
    }

    // Update session last_activity
    const baseUpdates = {
      last_activity: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from("user_sessions")
      .update(baseUpdates)
      .eq("id", sessionId);

    // Increment counters separately using RPC functions if needed
    if (path || actionType) {
      // For now, we'll update without incrementing. In production, you'd use RPC functions
      const { data: currentSession } = await supabase
        .from("user_sessions")
        .select("pages_visited, actions_count")
        .eq("id", sessionId)
        .single();

      if (currentSession) {
        const incrementUpdates: any = {};
        if (path) {
          incrementUpdates.pages_visited = (currentSession.pages_visited || 0) + 1;
        }
        if (actionType) {
          incrementUpdates.actions_count = (currentSession.actions_count || 0) + 1;
        }

        if (Object.keys(incrementUpdates).length > 0) {
          await supabase
            .from("user_sessions")
            .update(incrementUpdates)
            .eq("id", sessionId);
        }
      }
    }

    if (updateError) {
      console.error("Error updating session:", updateError);
    }

    // Log page view if path provided
    if (path) {
      const { error: pageViewError } = await supabase
        .from("user_page_views")
        .insert({
          session_id: sessionId,
          user_id: user.id,
          district_id: session.district_id,
          school_id: session.school_id,
          page_path: path,
          page_title: pageTitle || "",
          viewed_at: new Date().toISOString()
        });

      if (pageViewError) {
        console.error("Error logging page view:", pageViewError);
      }
    }

    // Log user action if actionType provided
    if (actionType) {
      const { error: actionError } = await supabase
        .from("user_actions")
        .insert({
          session_id: sessionId,
          user_id: user.id,
          district_id: session.district_id,
          school_id: session.school_id,
          action_type: actionType,
          action_details: actionDetails || {},
          page_path: path || "",
          assignment_id: assignmentId || null,
          performed_at: new Date().toISOString()
        });

      if (actionError) {
        console.error("Error logging user action:", actionError);
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error("Error in session activity API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}