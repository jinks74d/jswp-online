// app/api/dashboard/classes/[id]/assign-teacher/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log("Teacher assignment API called for class:", params.id);

    // Verify the user has permission
    const cookieStore = await cookies();
    const supabase = await createServerSupabaseClient(cookieStore);

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile to verify role and school
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, district_id, school_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    // Only school_admin and district_admin can assign teachers
    if (!["school_admin", "district_admin"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { teacherId } = body;

    if (!teacherId) {
      return NextResponse.json(
        { error: "Teacher ID is required" },
        { status: 400 }
      );
    }

    // Verify the class period exists and belongs to the user's school
    const { data: classPeriod, error: classPeriodError } = await supabase
      .from("class_periods")
      .select("id, school_id")
      .eq("id", params.id)
      .single();

    if (classPeriodError || !classPeriod) {
      return NextResponse.json(
        { error: "Class period not found" },
        { status: 404 }
      );
    }

    // Validate school access for school admins
    if (profile.role === "school_admin" && profile.school_id !== classPeriod.school_id) {
      return NextResponse.json(
        { error: "Cannot assign teachers to classes in other schools" },
        { status: 403 }
      );
    }

    // Verify the teacher exists and belongs to the same school
    const { data: teacher, error: teacherError } = await supabase
      .from("user_profiles")
      .select("id, role, school_id, first_name, last_name, email")
      .eq("id", teacherId)
      .eq("role", "teacher")
      .eq("school_id", classPeriod.school_id)
      .single();

    if (teacherError || !teacher) {
      return NextResponse.json(
        { error: "Teacher not found or not in the same school" },
        { status: 400 }
      );
    }

    // Check if teacher is already assigned to this class
    const { data: existingAssignment, error: existingError } = await supabase
      .from("class_teacher_assignments")
      .select("id")
      .eq("class_period_id", params.id)
      .eq("teacher_id", teacherId)
      .single();

    if (existingAssignment) {
      return NextResponse.json(
        { error: "Teacher is already assigned to this class" },
        { status: 400 }
      );
    }

    // Create the teacher assignment
    const { data: assignment, error: createError } = await supabase
      .from("class_teacher_assignments")
      .insert({
        class_period_id: params.id,
        teacher_id: teacherId,
        assigned_by: user.id,
        school_id: classPeriod.school_id,
      })
      .select(`
        *,
        teacher:teacher_id(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .single();

    if (createError) {
      return NextResponse.json(
        { error: `Failed to assign teacher: ${createError.message}` },
        { status: 500 }
      );
    }

    console.log("Teacher assigned successfully!");

    // Return success
    return NextResponse.json({
      success: true,
      assignment: {
        id: assignment.id,
        teacher: assignment.teacher,
        assigned_at: assignment.created_at,
      },
    });
  } catch (error: any) {
    console.error("Teacher assignment error:", error);
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log("Teacher unassignment API called for class:", params.id);

    // Verify the user has permission
    const cookieStore = await cookies();
    const supabase = await createServerSupabaseClient(cookieStore);

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile to verify role and school
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, district_id, school_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    // Only school_admin and district_admin can unassign teachers
    if (!["school_admin", "district_admin"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { teacherId } = body;

    if (!teacherId) {
      return NextResponse.json(
        { error: "Teacher ID is required" },
        { status: 400 }
      );
    }

    // Delete the teacher assignment
    const { error: deleteError } = await supabase
      .from("class_teacher_assignments")
      .delete()
      .eq("class_period_id", params.id)
      .eq("teacher_id", teacherId);

    if (deleteError) {
      return NextResponse.json(
        { error: `Failed to unassign teacher: ${deleteError.message}` },
        { status: 500 }
      );
    }

    console.log("Teacher unassigned successfully!");

    return NextResponse.json({
      success: true,
      message: "Teacher unassigned successfully",
    });
  } catch (error: any) {
    console.error("Teacher unassignment error:", error);
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}
