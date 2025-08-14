// app/api/schools/[schoolId]/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ schoolId: string }> }
) {
  try {
    const { schoolId } = await params;
    const body = await request.json();
    const { name, address, primary_color, secondary_color } = body;

    const cookieStore = await cookies();
    const supabase = await createServerSupabaseClient(cookieStore);

    // Get current user session for permission check
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user profile to check permissions
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, school_id, district_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 403 }
      );
    }

    // Check if user has permission to update this school
    const canUpdate = 
      profile.role === "super_admin" ||
      (profile.role === "school_admin" && profile.school_id === schoolId) ||
      (profile.role === "district_admin" && profile.district_id);

    if (!canUpdate) {
      return NextResponse.json(
        { error: "Insufficient permissions to update school settings" },
        { status: 403 }
      );
    }

    // Verify school exists and user has access
    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("id, district_id")
      .eq("id", schoolId)
      .single();

    if (schoolError || !school) {
      return NextResponse.json(
        { error: "School not found" },
        { status: 404 }
      );
    }

    // For district admins, verify they can access this school's district
    if (profile.role === "district_admin" && profile.district_id !== school.district_id) {
      return NextResponse.json(
        { error: "Insufficient permissions to update this school" },
        { status: 403 }
      );
    }

    // Update school information
    const { data: updatedSchool, error: updateError } = await supabase
      .from("schools")
      .update({
        name: name,
        address: address,
        primary_color: primary_color,
        secondary_color: secondary_color,
        updated_at: new Date().toISOString(),
      })
      .eq("id", schoolId)
      .select()
      .single();

    if (updateError) {
      console.error("Database update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update school settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "School settings updated successfully",
      school: updatedSchool
    });

  } catch (error) {
    console.error("School settings update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}