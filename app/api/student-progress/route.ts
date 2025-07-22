import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    console.log("POST /api/student-progress called");
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

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Auth error:", userError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("User authenticated:", user.id);

    const body = await request.json();
    console.log("Request body:", body);
    
    const {
      assignment_id,
      student_id,
      working_on,
      paragraph_name,
      selected_chunks,
      notes,
      concrete_details,
      status,
      writing_style,
    } = body;

    // Validate required fields
    if (!assignment_id || !student_id) {
      console.error("Missing required fields:", { assignment_id, student_id });
      return NextResponse.json(
        { error: "Assignment ID and Student ID are required" },
        { status: 400 }
      );
    }

    console.log("Checking for existing progress...");

    // Check if progress record already exists
    const { data: existingProgress, error: fetchError } = await supabase
      .from("student_assignment_progress")
      .select("*")
      .eq("assignment_id", assignment_id)
      .eq("student_id", student_id)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error fetching existing progress:", fetchError);
    }

    console.log("Existing progress:", existingProgress);

    const progressData = {
      assignment_id,
      student_id,
      working_on: working_on || existingProgress?.working_on,
      paragraph_name: paragraph_name || existingProgress?.paragraph_name,
      selected_chunks: selected_chunks || existingProgress?.selected_chunks,
      notes: notes || existingProgress?.notes,
      concrete_details: concrete_details || existingProgress?.concrete_details,
      writing_style: writing_style || existingProgress?.writing_style,
      status: status || existingProgress?.status || "in_progress",
      last_saved: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log("Progress data to save:", progressData);

    let result;
    if (existingProgress) {
      console.log("Updating existing record...");
      // Update existing record
      const { data, error } = await supabase
        .from("student_assignment_progress")
        .update(progressData)
        .eq("assignment_id", assignment_id)
        .eq("student_id", student_id)
        .select()
        .single();

      if (error) {
        console.error("Error updating progress:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      console.log("Update successful:", data);
      result = data;
    } else {
      console.log("Creating new record...");
      // Create new record
      const { data, error } = await supabase
        .from("student_assignment_progress")
        .insert({
          ...progressData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating progress:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      console.log("Create successful:", data);
      result = data;
    }

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    console.error("Error in student progress API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
              // This can be ignored if you have middleware refreshing
              // user sessions.
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

    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get("assignment_id");
    const student_id = searchParams.get("student_id");

    if (!assignment_id || !student_id) {
      return NextResponse.json(
        { error: "Assignment ID and Student ID are required" },
        { status: 400 }
      );
    }

    // Get progress record
    const { data: progress, error } = await supabase
      .from("student_assignment_progress")
      .select("*")
      .eq("assignment_id", assignment_id)
      .eq("student_id", student_id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found" error, which is okay
      console.error("Error fetching progress:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: progress }, { status: 200 });
  } catch (error) {
    console.error("Error in student progress GET API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
