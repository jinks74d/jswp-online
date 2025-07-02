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
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get the current user's profile to check role
    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, school_id")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Only teachers and admins can provide feedback
    if (!["teacher", "school_admin", "district_admin"].includes(userProfile.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { progressId, stepKey, feedback } = body;

    if (!progressId || !stepKey || feedback === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: progressId, stepKey, feedback" },
        { status: 400 }
      );
    }

    console.log("Attempting to update feedback for progress ID:", progressId);
    console.log("Step key:", stepKey);
    console.log("Feedback:", feedback);

    // First, get the current progress record to merge feedback
    const { data: currentProgress, error: fetchError } = await supabase
      .from("student_assignment_progress")
      .select("teacher_feedback")
      .eq("id", progressId)
      .single();

    if (fetchError) {
      console.error("Error fetching progress record:", fetchError);
      return NextResponse.json(
        { error: "Progress record not found", details: fetchError.message },
        { status: 404 }
      );
    }

    // Merge the new feedback with existing feedback
    const currentFeedback = currentProgress.teacher_feedback || {};
    const updatedFeedback = {
      ...currentFeedback,
      [stepKey]: feedback
    };

    console.log("Current feedback:", currentFeedback);
    console.log("Updated feedback:", updatedFeedback);

    // Update the progress record with the new feedback
    const { data, error } = await supabase
      .from("student_assignment_progress")
      .update({ 
        teacher_feedback: updatedFeedback,
        updated_at: new Date().toISOString()
      })
      .eq("id", progressId)
      .select()
      .single();

    if (error) {
      console.error("Error updating teacher feedback:", error);
      return NextResponse.json(
        { error: "Failed to save feedback", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error("Error in teacher feedback API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
