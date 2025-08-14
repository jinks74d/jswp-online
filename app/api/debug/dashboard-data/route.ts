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

    // Test data queries based on user role
    const results: any = {
      user: {
        id: user.id,
        email: user.email,
      },
      profile: {
        id: profile.id,
        role: profile.role,
        district_id: profile.district_id,
        school_id: profile.school_id,
        district_name: (profile.districts as any)?.name,
        school_name: (profile.schools as any)?.name,
      },
      data: {},
    };

    // Test assignments query
    try {
      let assignmentsQuery = supabase.from("assignments").select("*");

      if (profile.role === "teacher") {
        assignmentsQuery = assignmentsQuery.eq("teacher_id", profile.id);
      } else if (profile.role === "student") {
        assignmentsQuery = assignmentsQuery.eq("school_id", profile.school_id);
      } else if (profile.role === "school_admin") {
        assignmentsQuery = assignmentsQuery.eq("school_id", profile.school_id);
      } else if (profile.role === "district_admin") {
        assignmentsQuery = assignmentsQuery.eq(
          "district_id",
          profile.district_id
        );
      }

      const { data: assignments, error: assignmentsError } =
        await assignmentsQuery
          .order("created_at", { ascending: false })
          .limit(10);

      results.data.assignments = {
        count: assignments?.length || 0,
        error: assignmentsError?.message,
        sample: assignments?.slice(0, 3),
      };
    } catch (error) {
      results.data.assignments = {
        count: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    // Test users query (teachers/students)
    try {
      let usersQuery = supabase
        .from("user_profiles")
        .select("id, role, email, first_name, last_name");

      if (profile.role === "school_admin") {
        usersQuery = usersQuery
          .eq("school_id", profile.school_id)
          .in("role", ["teacher", "student"]);
      } else if (profile.role === "district_admin") {
        usersQuery = usersQuery
          .eq("district_id", profile.district_id)
          .in("role", ["teacher", "student", "school_admin"]);
      } else if (profile.role === "teacher") {
        usersQuery = usersQuery
          .eq("school_id", profile.school_id)
          .eq("role", "student");
      }

      const { data: users, error: usersError } = await usersQuery
        .order("created_at", { ascending: false })
        .limit(10);

      results.data.users = {
        count: users?.length || 0,
        error: usersError?.message,
        breakdown:
          users?.reduce((acc: any, user: any) => {
            acc[user.role] = (acc[user.role] || 0) + 1;
            return acc;
          }, {}) || {},
        sample: users?.slice(0, 3),
      };
    } catch (error) {
      results.data.users = {
        count: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    // Test classes query
    try {
      const { data: classes, error: classesError } = await supabase
        .from("class_periods")
        .select(
          `
          id, period,
          classes:class_id(id, name, subjects:subject_id(name))
        `
        )
        .eq("school_id", profile.school_id)
        .limit(10);

      results.data.classes = {
        count: classes?.length || 0,
        error: classesError?.message,
        sample: classes?.slice(0, 3),
      };
    } catch (error) {
      results.data.classes = {
        count: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    // Test schools query (for district admins)
    if (profile.role === "district_admin") {
      try {
        const { data: schools, error: schoolsError } = await supabase
          .from("schools")
          .select("id, name, address")
          .eq("district_id", profile.district_id)
          .limit(10);

        results.data.schools = {
          count: schools?.length || 0,
          error: schoolsError?.message,
          sample: schools?.slice(0, 3),
        };
      } catch (error) {
        results.data.schools = {
          count: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Dashboard data debug error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
