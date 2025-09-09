// app/api/debug/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createServerSupabaseClient(cookieStore);

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({
        error: "Not authenticated",
        details: userError?.message,
      }, { status: 401 });
    }

    // Get user profile with all relationships
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select(
        `
        *,
        districts:district_id(id, name, logo_url, primary_color, secondary_color),
        schools:school_id(id, name, logo_url, primary_color, secondary_color)
      `
      )
      .eq("id", user.id)
      .single();

    if (profileError) {
      return NextResponse.json({
        error: "Profile fetch failed",
        details: profileError.message,
      }, { status: 500 });
    }

    // Check what would cause redirects in Teachers/Students pages
    const diagnostics = {
      hasProfile: !!profile,
      hasDistrictId: !!profile?.district_id,
      hasSchoolId: !!profile?.school_id,
      role: profile?.role,
      canAccessTeachersPage: profile && profile.district_id && ["district_admin", "school_admin", "teacher"].includes(profile.role),
      canAccessStudentsPage: profile && profile.district_id && ["district_admin", "school_admin", "teacher"].includes(profile.role),
      redirectReasons: [] as string[]
    };

    // Determine potential redirect reasons
    if (!profile) {
      diagnostics.redirectReasons.push("No profile found");
    }
    if (!profile?.district_id) {
      diagnostics.redirectReasons.push("Missing district_id (would redirect to '/')");
    }
    if (profile && !["district_admin", "school_admin", "teacher"].includes(profile.role)) {
      diagnostics.redirectReasons.push("Role not allowed (would redirect to '/dashboard')");
    }
    if (profile?.role === "school_admin" && !profile?.school_id) {
      diagnostics.redirectReasons.push("School admin missing school_id (may affect data queries)");
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
      profile: profile,
      diagnostics: diagnostics,
    });

  } catch (error) {
    console.error("Debug profile error:", error);
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}