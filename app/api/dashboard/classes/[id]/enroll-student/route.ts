// app/api/dashboard/classes/[id]/enroll-student/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  try {
    console.log("Student enrollment API called for class:", resolvedParams.id);

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

    // Only school_admin and district_admin can enroll students
    if (!["school_admin", "district_admin"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json(
        { error: "Student ID is required" },
        { status: 400 }
      );
    }

    // Verify the class period exists and belongs to the user's school
    const { data: classPeriod, error: classPeriodError } = await supabase
      .from("class_periods")
      .select("id, school_id")
      .eq("id", resolvedParams.id)
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
        { error: "Cannot enroll students in classes from other schools" },
        { status: 403 }
      );
    }

    // Verify the student exists and belongs to the same school
    const { data: student, error: studentError } = await supabase
      .from("user_profiles")
      .select("id, role, school_id, first_name, last_name, email")
      .eq("id", studentId)
      .eq("role", "student")
      .eq("school_id", classPeriod.school_id)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { error: "Student not found or not in the same school" },
        { status: 400 }
      );
    }

    // Check if student is already enrolled in this class
    const { data: existingEnrollment, error: existingError } = await supabase
      .from("class_student_enrollments")
      .select("id")
      .eq("class_period_id", resolvedParams.id)
      .eq("student_id", studentId)
      .single();

    if (existingEnrollment) {
      return NextResponse.json(
        { error: "Student is already enrolled in this class" },
        { status: 400 }
      );
    }

    // Create the student enrollment
    const { data: enrollment, error: createError } = await supabase
      .from("class_student_enrollments")
      .insert({
        class_period_id: resolvedParams.id,
        student_id: studentId,
        enrolled_by: user.id,
        school_id: classPeriod.school_id,
      })
      .select(`
        *,
        student:student_id(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .single();

    if (createError) {
      return NextResponse.json(
        { error: `Failed to enroll student: ${createError.message}` },
        { status: 500 }
      );
    }

    console.log("Student enrolled successfully!");

    // Return success
    return NextResponse.json({
      success: true,
      enrollment: {
        id: enrollment.id,
        student: enrollment.student,
        enrolled_at: enrollment.created_at,
      },
    });
  } catch (error: any) {
    console.error("Student enrollment error:", error);
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  try {
    console.log("Student unenrollment API called for class:", resolvedParams.id);

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

    // Only school_admin and district_admin can unenroll students
    if (!["school_admin", "district_admin"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json(
        { error: "Student ID is required" },
        { status: 400 }
      );
    }

    // Delete the student enrollment
    const { error: deleteError } = await supabase
      .from("class_student_enrollments")
      .delete()
      .eq("class_period_id", resolvedParams.id)
      .eq("student_id", studentId);

    if (deleteError) {
      return NextResponse.json(
        { error: `Failed to unenroll student: ${deleteError.message}` },
        { status: 500 }
      );
    }

    console.log("Student unenrolled successfully!");

    return NextResponse.json({
      success: true,
      message: "Student unenrolled successfully",
    });
  } catch (error: any) {
    console.error("Student unenrollment error:", error);
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}
