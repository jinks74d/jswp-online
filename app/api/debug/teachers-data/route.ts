import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
            } catch (error) {
              console.warn("Failed to set cookies:", error);
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
      return NextResponse.json(
        {
          error: "Unauthorized",
          details: userError?.message,
        },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select(
        `
        id, role, district_id, school_id, email, first_name, last_name,
        districts:district_id(id, name),
        schools:school_id(id, name)
      `
      )
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          error: "Profile not found",
          details: profileError?.message,
        },
        { status: 404 }
      );
    }

    const results: any = {
      currentUser: {
        id: user.id,
        email: user.email,
        role: profile.role,
        district_id: profile.district_id,
        school_id: profile.school_id,
        district_name: (profile.districts as any)?.name,
        school_name: (profile.schools as any)?.name,
      },
      queries: {},
    };

    // Test 1: Check if user_profiles table exists and has teacher role data
    try {
      const { data: allTeachers, error: allTeachersError } = await supabase
        .from("user_profiles")
        .select(
          "id, role, email, first_name, last_name, district_id, school_id"
        )
        .eq("role", "teacher");

      results.queries.allTeachers = {
        count: allTeachers?.length || 0,
        error: allTeachersError?.message,
        sample: allTeachers?.slice(0, 3),
      };
    } catch (error) {
      results.queries.allTeachers = {
        count: 0,
        error: error instanceof Error ? error.message : "Query failed",
      };
    }

    // Test 2: Check teachers in current district
    if (profile.district_id) {
      try {
        const { data: districtTeachers, error: districtTeachersError } =
          await supabase
            .from("user_profiles")
            .select(
              "id, role, email, first_name, last_name, district_id, school_id"
            )
            .eq("role", "teacher")
            .eq("district_id", profile.district_id);

        results.queries.districtTeachers = {
          count: districtTeachers?.length || 0,
          error: districtTeachersError?.message,
          sample: districtTeachers?.slice(0, 3),
        };
      } catch (error) {
        results.queries.districtTeachers = {
          count: 0,
          error: error instanceof Error ? error.message : "Query failed",
        };
      }
    }

    // Test 3: Check teachers in current school (for school admins)
    if (profile.role === "school_admin" && profile.school_id) {
      try {
        const { data: schoolTeachers, error: schoolTeachersError } =
          await supabase
            .from("user_profiles")
            .select(
              "id, role, email, first_name, last_name, district_id, school_id"
            )
            .eq("role", "teacher")
            .eq("school_id", profile.school_id);

        results.queries.schoolTeachers = {
          count: schoolTeachers?.length || 0,
          error: schoolTeachersError?.message,
          sample: schoolTeachers?.slice(0, 3),
        };
      } catch (error) {
        results.queries.schoolTeachers = {
          count: 0,
          error: error instanceof Error ? error.message : "Query failed",
        };
      }
    }

    // Test 4: Exact query from teachers page
    try {
      let teachersQuery = supabase
        .from("user_profiles")
        .select(
          `
          *,
          schools:school_id(id, name)
        `
        )
        .eq("role", "teacher")
        .eq("district_id", profile.district_id);

      // School admins can only see teachers from their school
      if (profile.role === "school_admin" && profile.school_id) {
        teachersQuery = teachersQuery.eq("school_id", profile.school_id);
      }

      const { data: pageTeachers, error: pageTeachersError } =
        await teachersQuery.order("created_at", { ascending: false });

      results.queries.pageQuery = {
        count: pageTeachers?.length || 0,
        error: pageTeachersError?.message,
        sample: pageTeachers?.slice(0, 3),
        fullQuery: {
          role: "teacher",
          district_id: profile.district_id,
          school_id:
            profile.role === "school_admin" ? profile.school_id : "any",
        },
      };
    } catch (error) {
      results.queries.pageQuery = {
        count: 0,
        error: error instanceof Error ? error.message : "Query failed",
      };
    }

    // Test 5: Check if there are any users with teacher role but different casing
    try {
      const { data: teacherVariants, error: teacherVariantsError } =
        await supabase
          .from("user_profiles")
          .select("id, role, email")
          .ilike("role", "%teacher%");

      results.queries.teacherVariants = {
        count: teacherVariants?.length || 0,
        error: teacherVariantsError?.message,
        roles: [...new Set(teacherVariants?.map((t) => t.role) || [])],
      };
    } catch (error) {
      results.queries.teacherVariants = {
        count: 0,
        error: error instanceof Error ? error.message : "Query failed",
      };
    }

    // Test 6: Check all roles in the system
    try {
      const { data: allRoles, error: allRolesError } = await supabase
        .from("user_profiles")
        .select("role")
        .not("role", "is", null);

      const roleBreakdown =
        allRoles?.reduce((acc: any, user: any) => {
          acc[user.role] = (acc[user.role] || 0) + 1;
          return acc;
        }, {}) || {};

      results.queries.allRoles = {
        breakdown: roleBreakdown,
        error: allRolesError?.message,
      };
    } catch (error) {
      results.queries.allRoles = {
        breakdown: {},
        error: error instanceof Error ? error.message : "Query failed",
      };
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Teachers data debug error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
