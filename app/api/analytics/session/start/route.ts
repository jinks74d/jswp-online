import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import { AsyncHandler } from "@/lib/async-handler";
import {
  AppError,
  ErrorType,
  ErrorSeverity,
  createTableNotFoundError,
  createAuthError,
} from "@/lib/errors";

export async function POST(request: NextRequest) {
  const result = await AsyncHandler.execute(
    async () => {
      const cookieStore = await cookies();
      const supabase = await createServerSupabaseClient(cookieStore);

      // Get current user with enhanced validation
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user || !user.id || !user.email) {
        console.error("Authentication error:", userError || "Incomplete user data");
        throw createAuthError("User authentication failed", {
          metadata: { 
            userError: userError?.message || "User data incomplete",
            hasUser: !!user,
            hasUserId: !!(user?.id),
            hasUserEmail: !!(user?.email)
          },
        });
      }

      console.log("Session start request for user:", user.email);

      // Get user profile with district and school info
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select(
          `
          id,
          role,
          district_id,
          school_id,
          districts:district_id(id, name),
          schools:school_id(id, name)
        `
        )
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        console.error("Profile fetch error:", profileError);
        throw new AppError({
          type: ErrorType.RESOURCE_NOT_FOUND,
          message: "Profile not found",
          severity: ErrorSeverity.HIGH,
          context: {
            userId: user.id,
            metadata: { profileError: profileError?.message },
          },
        });
      }

      console.log("Profile found:", {
        role: profile.role,
        district_id: profile.district_id,
        school_id: profile.school_id,
      });

      // Get client info
      const userAgent = request.headers.get("user-agent") || "";
      const clientIP =
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        "unknown";

      // Parse browser/device info
      const deviceType = userAgent.toLowerCase().includes("mobile")
        ? "mobile"
        : userAgent.toLowerCase().includes("tablet")
        ? "tablet"
        : "desktop";

      // Check for existing active session and end it
      const { error: updateError } = await supabase
        .from("user_sessions")
        .update({
          session_end: new Date().toISOString(),
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (updateError) {
        console.warn("Error ending previous sessions:", updateError);
      }

      // Create new session
      const { data: session, error: sessionError } = await supabase
        .from("user_sessions")
        .insert({
          user_id: user.id,
          district_id: profile.district_id,
          school_id: profile.school_id,
          session_start: new Date().toISOString(),
          last_activity: new Date().toISOString(),
          ip_address: clientIP,
          user_agent: userAgent,
          device_type: deviceType,
          browser_info: {
            userAgent,
            language: request.headers.get("accept-language") || "",
            referrer: request.headers.get("referer") || "",
          },
          is_active: true,
        })
        .select("id")
        .single();

      if (sessionError) {
        console.error("Error creating session:", sessionError);

        // Check if it's a table not found error
        if (
          sessionError.message?.includes(
            'relation "user_sessions" does not exist'
          )
        ) {
          throw createTableNotFoundError("user_sessions", {
            userId: user.id,
            metadata: { operation: "session_start" },
          });
        }

        throw new AppError({
          type: ErrorType.DATABASE_QUERY_FAILED,
          message: `Failed to create session: ${sessionError.message}`,
          severity: ErrorSeverity.HIGH,
          context: {
            userId: user.id,
            metadata: { sessionError: sessionError.message },
          },
        });
      }

      console.log("Session created successfully:", session.id);

      return {
        success: true,
        sessionId: session.id,
        message: "Session started successfully",
      };
    },
    {
      operationName: "startAnalyticsSession",
      timeout: 10000,
      retries: 1,
      context: { metadata: { endpoint: "/api/analytics/session/start" } },
    }
  );

  if (!result.success) {
    const error = result.error!;

    // Map error types to HTTP status codes
    let statusCode = 500;
    if (
      error.type === ErrorType.AUTHENTICATION_FAILED ||
      error.type === ErrorType.AUTHORIZATION_DENIED
    ) {
      statusCode = 401;
    } else if (error.type === ErrorType.RESOURCE_NOT_FOUND) {
      statusCode = 404;
    } else if (error.type === ErrorType.TABLE_NOT_FOUND) {
      statusCode = 503;
    }

    return NextResponse.json(
      {
        error: error.userMessage,
        details: error.technicalMessage,
        type: error.type,
        ...(error.type === ErrorType.TABLE_NOT_FOUND && {
          hint: "Check migrations/create-analytics-schema.sql",
        }),
      },
      { status: statusCode }
    );
  }

  return NextResponse.json(result.data);
}
