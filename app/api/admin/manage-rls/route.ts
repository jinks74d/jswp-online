import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role key for admin operations
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

    let result;

    switch (action) {
      case "disable_rls":
        result = await supabase.rpc("disable_rls_user_profiles");
        break;
      case "enable_rls":
        result = await supabase.rpc("enable_rls_user_profiles");
        break;
      case "check_rls":
        // Check RLS status
        const { data: rlsStatus } = await supabase
          .from("pg_class")
          .select("relrowsecurity")
          .eq("relname", "user_profiles")
          .single();
        result = {
          data: { rls_enabled: rlsStatus?.relrowsecurity },
          error: null,
        };
        break;
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({
      success: !result.error,
      action,
      result: result.data,
      error: result.error?.message,
    });
  } catch (error) {
    console.error("RLS management error:", error);
    return NextResponse.json(
      {
        error: "Failed to manage RLS",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Simple RLS management without service role
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

    // Try to query user_profiles to see if RLS is blocking
    const { data: testQuery, error: testError } = await supabase
      .from("user_profiles")
      .select("count")
      .limit(1);

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    return NextResponse.json({
      rls_status: {
        can_query: !testError,
        query_error: testError?.message,
        user_authenticated: !!user,
        auth_error: authError?.message,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to check RLS status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
