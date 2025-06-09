// app/api/student-progress/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createServerSupabaseClient(cookieStore);

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const {
      assignment_id,
      student_id,
      working_on,
      paragraph_name,
      selected_chunks,
      notes,
      concrete_details,
      status = "in_progress",
    } = body;

    // Validate required fields
    if (!assignment_id || !student_id) {
      return NextResponse.json(
        { error: "Assignment ID and Student ID are required" },
        { status: 400 }
      );
    }

    // Verify the current user is the student or has permission
    if (user.id !== student_id) {
      // Check if user is a teacher/admin with permission
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || !["teacher", "school_admin", "district_admin"].includes(profile.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Prepare data for upsert (insert or update)
    const progressData = {
      assignment_id,
      student_id,
      working_on,
      paragraph_name,
      selected_chunks: selected_chunks || 1,
      notes,
      concrete_details,
      status,
      last_saved: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Use upsert to insert or update the record
    const { data, error } = await supabase
      .from("student_assignment_progress")
      .upsert(progressData, {
        onConflict: "assignment_id,student_id",
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to save progress", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Progress saved successfully",
      data: data[0],
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createServerSupabaseClient(cookieStore);

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get("assignment_id");
    const studentId = searchParams.get("student_id");

    if (!assignmentId || !studentId) {
      return NextResponse.json(
        { error: "Assignment ID and Student ID are required" },
        { status: 400 }
      );
    }

    // Verify the current user has permission to view this progress
    if (user.id !== studentId) {
      // Check if user is a teacher/admin with permission
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || !["teacher", "school_admin", "district_admin"].includes(profile.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Fetch the progress record
    const { data, error } = await supabase
      .from("student_assignment_progress")
      .select("*")
      .eq("assignment_id", assignmentId)
      .eq("student_id", studentId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found" which is okay
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch progress" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || null,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
