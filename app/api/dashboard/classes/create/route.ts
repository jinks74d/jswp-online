// app/api/dashboard/classes/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    console.log("Class creation API called");

    // Verify the user has permission
    const cookieStore = await cookies();
    const supabase = await createServerSupabaseClient(cookieStore);

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    console.log("User check:", { user: user?.id, error: authError });

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile to verify role and school
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, district_id, school_id")
      .eq("id", user.id)
      .single();

    console.log("Profile check:", {
      role: profile?.role,
      schoolId: profile?.school_id,
      error: profileError,
    });

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    // Only school_admin and district_admin can create classes
    if (!["school_admin", "district_admin"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    console.log("Request body:", body);

    const { subjectId, classId, period, schoolId } = body;

    // Validate required fields
    if (!subjectId || !classId || !period || !schoolId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate school access for school admins
    if (profile.role === "school_admin" && profile.school_id !== schoolId) {
      return NextResponse.json(
        { error: "Cannot create classes for other schools" },
        { status: 403 }
      );
    }

    // Verify subject exists and belongs to the school
    const { data: subject, error: subjectError } = await supabase
      .from("subjects")
      .select("id, school_id")
      .eq("id", subjectId)
      .eq("school_id", schoolId)
      .single();

    if (subjectError || !subject) {
      return NextResponse.json(
        { error: "Invalid subject selection" },
        { status: 400 }
      );
    }

    // Verify class exists and belongs to the subject and school
    const { data: classItem, error: classError } = await supabase
      .from("classes")
      .select("id, subject_id, school_id")
      .eq("id", classId)
      .eq("subject_id", subjectId)
      .eq("school_id", schoolId)
      .single();

    if (classError || !classItem) {
      return NextResponse.json(
        { error: "Invalid class selection" },
        { status: 400 }
      );
    }

    // Check if a class period with the same class and period already exists
    const { data: existingPeriod, error: existingError } = await supabase
      .from("class_periods")
      .select("id")
      .eq("class_id", classId)
      .eq("period", period.trim())
      .single();

    if (existingPeriod) {
      return NextResponse.json(
        { error: "A class period with this period already exists for this class" },
        { status: 400 }
      );
    }

    // Create the class period
    console.log("Creating class period...");
    const { data: classPeriod, error: createError } = await supabase
      .from("class_periods")
      .insert({
        class_id: classId,
        period: period.trim(),
        school_id: schoolId,
        created_by: user.id,
      })
      .select(`
        *,
        classes:class_id(
          id,
          name,
          subjects:subject_id(
            id,
            name
          )
        )
      `)
      .single();

    console.log("Class period creation result:", { classPeriod, error: createError });

    if (createError) {
      return NextResponse.json(
        {
          error: `Failed to create class period: ${createError.message}`,
        },
        { status: 500 }
      );
    }

    console.log("Class period created successfully!");

    // Return success
    return NextResponse.json({
      success: true,
      classPeriod: {
        id: classPeriod.id,
        period: classPeriod.period,
        class: {
          id: classPeriod.classes.id,
          name: classPeriod.classes.name,
          subject: {
            id: classPeriod.classes.subjects.id,
            name: classPeriod.classes.subjects.name,
          },
        },
      },
    });
  } catch (error: any) {
    console.error("Class creation error:", error);
    return NextResponse.json(
      {
        error: `Server error: ${error.message}`,
      },
      { status: 500 }
    );
  }
}
