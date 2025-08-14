import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    console.log("Testing Supabase connection...");

    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        {
          error: "Missing Supabase environment variables",
          details: {
            hasUrl: !!supabaseUrl,
            hasKey: !!supabaseKey,
          },
        },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
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
    });

    // Test basic connection
    const { data: testData, error: testError } = await supabase
      .from("user_profiles")
      .select("count")
      .limit(1);

    // Test auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    return NextResponse.json({
      success: true,
      connection: {
        supabaseUrl: supabaseUrl?.substring(0, 30) + "...",
        hasKey: !!supabaseKey,
        testQuery: {
          success: !testError,
          error: testError?.message,
        },
        auth: {
          hasUser: !!user,
          userId: user?.id,
          error: authError?.message,
        },
      },
    });
  } catch (error) {
    console.error("Connection test error:", error);
    return NextResponse.json(
      {
        error: "Connection test failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
