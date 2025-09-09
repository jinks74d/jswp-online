// app/api/debug/user-profile/route.ts
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
        id, role, district_id, school_id, first_name, last_name, email,
        districts:district_id(id, name),
        schools:school_id(id, name)
      `
      )
      .eq("id", user.id)
      .single();

    if (profileError) {
      return NextResponse.json({
        error: "Profile fetch failed",
        details: profileError.message,
        profile_error_code: profileError.code,
      }, { status: 500 });
    }

    // Check redirect conditions for Teachers/Students pages
    const redirectChecks = {
      hasProfile: !!profile,
      hasDistrictId: !!profile?.district_id,
      hasSchoolId: !!profile?.school_id,
      roleCheck: profile ? ["district_admin", "school_admin", "teacher"].includes(profile.role) : false,
      
      // This is what causes the redirect back to dashboard
      wouldRedirectToHome: !profile || !profile.district_id,
      wouldRedirectToDashboard: profile ? !["district_admin", "school_admin", "teacher"].includes(profile.role) : true,
      
      // For school admins specifically
      isSchoolAdmin: profile?.role === "school_admin",
      schoolAdminHasSchoolId: profile?.role === "school_admin" && !!profile?.school_id,
    };

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
      profile: profile,
      redirect_analysis: redirectChecks,
      recommendation: redirectChecks.wouldRedirectToHome 
        ? "Missing district_id - would redirect to home page"
        : redirectChecks.wouldRedirectToDashboard
        ? "Role not allowed - would redirect to dashboard"
        : redirectChecks.isSchoolAdmin && !redirectChecks.schoolAdminHasSchoolId
        ? "School admin missing school_id - may cause data query issues"
        : "Profile should work for Teachers/Students pages"
    });

  } catch (error) {
    console.error("Debug profile error:", error);
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}