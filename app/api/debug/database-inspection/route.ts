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
      .select("*")
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
      },
      database: {},
    };

    // 1. Check all user_profiles records
    try {
      const { data: allUsers, error: allUsersError } = await supabase
        .from("user_profiles")
        .select(
          "id, role, email, first_name, last_name, district_id, school_id, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(50);

      results.database.allUsers = {
        count: allUsers?.length || 0,
        error: allUsersError?.message,
        sample: allUsers?.slice(0, 10),
        roleBreakdown:
          allUsers?.reduce((acc: any, user: any) => {
            acc[user.role || "null"] = (acc[user.role || "null"] || 0) + 1;
            return acc;
          }, {}) || {},
        districtBreakdown:
          allUsers?.reduce((acc: any, user: any) => {
            const key = user.district_id || "null";
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          }, {}) || {},
        schoolBreakdown:
          allUsers?.reduce((acc: any, user: any) => {
            const key = user.school_id || "null";
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          }, {}) || {},
      };
    } catch (error) {
      results.database.allUsers = {
        count: 0,
        error: error instanceof Error ? error.message : "Query failed",
      };
    }

    // 2. Check districts table
    try {
      const { data: districts, error: districtsError } = await supabase
        .from("districts")
        .select("*")
        .limit(20);

      results.database.districts = {
        count: districts?.length || 0,
        error: districtsError?.message,
        sample: districts?.slice(0, 5),
      };
    } catch (error) {
      results.database.districts = {
        count: 0,
        error: error instanceof Error ? error.message : "Query failed",
      };
    }

    // 3. Check schools table
    try {
      const { data: schools, error: schoolsError } = await supabase
        .from("schools")
        .select("*")
        .limit(20);

      results.database.schools = {
        count: schools?.length || 0,
        error: schoolsError?.message,
        sample: schools?.slice(0, 5),
      };
    } catch (error) {
      results.database.schools = {
        count: 0,
        error: error instanceof Error ? error.message : "Query failed",
      };
    }

    // 4. Check assignments table
    try {
      const { data: assignments, error: assignmentsError } = await supabase
        .from("assignments")
        .select("*")
        .limit(20);

      results.database.assignments = {
        count: assignments?.length || 0,
        error: assignmentsError?.message,
        sample: assignments?.slice(0, 5),
      };
    } catch (error) {
      results.database.assignments = {
        count: 0,
        error: error instanceof Error ? error.message : "Query failed",
      };
    }

    // 5. Check for users with role variations
    try {
      const { data: roleVariations, error: roleVariationsError } =
        await supabase
          .from("user_profiles")
          .select("role")
          .not("role", "is", null);

      const uniqueRoles = [
        ...new Set(roleVariations?.map((r) => r.role) || []),
      ];

      results.database.roleVariations = {
        uniqueRoles,
        error: roleVariationsError?.message,
      };
    } catch (error) {
      results.database.roleVariations = {
        uniqueRoles: [],
        error: error instanceof Error ? error.message : "Query failed",
      };
    }

    // 6. Check your specific school and district data
    if (profile.school_id) {
      try {
        const { data: schoolData, error: schoolDataError } = await supabase
          .from("schools")
          .select("*")
          .eq("id", profile.school_id)
          .single();

        results.database.yourSchool = {
          data: schoolData,
          error: schoolDataError?.message,
        };
      } catch (error) {
        results.database.yourSchool = {
          data: null,
          error: error instanceof Error ? error.message : "Query failed",
        };
      }
    }

    if (profile.district_id) {
      try {
        const { data: districtData, error: districtDataError } = await supabase
          .from("districts")
          .select("*")
          .eq("id", profile.district_id)
          .single();

        results.database.yourDistrict = {
          data: districtData,
          error: districtDataError?.message,
        };
      } catch (error) {
        results.database.yourDistrict = {
          data: null,
          error: error instanceof Error ? error.message : "Query failed",
        };
      }
    }

    // 7. Raw SQL to check table existence
    try {
      const { data: tables, error: tablesError } = await supabase
        .from("information_schema.tables")
        .select("table_name")
        .eq("table_schema", "public")
        .in("table_name", [
          "user_profiles",
          "districts",
          "schools",
          "assignments",
          "classes",
          "subjects",
        ]);

      results.database.tableExistence = {
        tables: tables?.map((t) => t.table_name) || [],
        error: tablesError?.message,
      };
    } catch (error) {
      results.database.tableExistence = {
        tables: [],
        error: error instanceof Error ? error.message : "Query failed",
      };
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Database inspection error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
