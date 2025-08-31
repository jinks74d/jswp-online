import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AsyncHandler } from "@/lib/async-handler";
import {
  AppError,
  ErrorType,
  ErrorSeverity,
  createTableNotFoundError,
  createAuthError,
} from "@/lib/errors";

export async function GET(request: NextRequest) {
  const result = await AsyncHandler.execute(
    async () => {
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
              } catch {
                // The `setAll` method was called from a Server Component.
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
        throw createAuthError("User authentication failed", {
          metadata: { userError: userError?.message },
        });
      }

      // Get user profile to determine access level
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("district_id, school_id, role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
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

      // Only allow admins to access analytics
      if (
        !["super_admin", "district_admin", "school_admin"].includes(
          profile.role
        )
      ) {
        throw new AppError({
          type: ErrorType.AUTHORIZATION_DENIED,
          message: "Insufficient permissions to access analytics",
          severity: ErrorSeverity.MEDIUM,
          context: { userId: user.id, metadata: { userRole: profile.role } },
        });
      }

      const { searchParams } = new URL(request.url);
      const timeRange = searchParams.get("range") || "7d"; // 7d, 30d, 90d
      const level = searchParams.get("level") || "auto"; // district, school, auto

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();

      switch (timeRange) {
        case "1d":
          startDate.setDate(startDate.getDate() - 1);
          break;
        case "7d":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(startDate.getDate() - 30);
          break;
        case "90d":
          startDate.setDate(startDate.getDate() - 90);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
      }

      // Determine scope based on user role and level parameter
      let districtFilter = null;
      let schoolFilter = null;

      if (profile.role === "super_admin" && level === "district") {
        // Super admin can view all districts or specific district
        const districtParam = searchParams.get("district_id");
        if (districtParam) districtFilter = districtParam;
      } else if (profile.role === "super_admin" && level === "school") {
        // Super admin can view specific school
        const schoolParam = searchParams.get("school_id");
        if (schoolParam) schoolFilter = schoolParam;
      } else if (profile.role === "district_admin") {
        // District admin sees their district
        districtFilter = profile.district_id;
        const schoolParam = searchParams.get("school_id");
        if (schoolParam && level === "school") schoolFilter = schoolParam;
      } else if (profile.role === "school_admin") {
        // School admin sees only their school
        districtFilter = profile.district_id;
        schoolFilter = profile.school_id;
      }

      // Build base query for sessions
      let sessionQuery = supabase
        .from("user_sessions")
        .select(
          `
        id,
        user_id,
        district_id,
        school_id,
        session_start,
        session_end,
        duration_minutes,
        pages_visited,
        actions_count,
        device_type,
        user_profiles!user_sessions_user_id_fkey(role, first_name, last_name),
        schools!user_sessions_school_id_fkey(id, name)
      `
        )
        .gte("session_start", startDate.toISOString())
        .lte("session_start", endDate.toISOString());

      if (districtFilter) {
        sessionQuery = sessionQuery.eq("district_id", districtFilter);
      }
      if (schoolFilter) {
        sessionQuery = sessionQuery.eq("school_id", schoolFilter);
      }

      const { data: sessions, error: sessionsError } = await sessionQuery
        .order("session_start", { ascending: false })
        .limit(1000);

      if (sessionsError) {
        console.error("Error fetching sessions:", sessionsError);

        // Check if it's a table not found error
        if (
          sessionsError.message?.includes(
            'relation "user_sessions" does not exist'
          )
        ) {
          // Return empty data structure for missing tables instead of throwing
          const emptyAnalytics = {
            summary: {
              totalSessions: 0,
              uniqueUsers: 0,
              currentActiveUsers: 0,
              averageSessionMinutes: 0,
              totalHours: 0,
              totalPageViews: 0,
              totalActions: 0,
              timeRange,
              dateRange: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
              },
            },
            breakdown: {
              roles: {},
              devices: {},
            },
            daily: [],
            scope: {
              level: schoolFilter
                ? "school"
                : districtFilter
                ? "district"
                : "system",
              districtId: districtFilter,
              schoolId: schoolFilter,
            },
            tablesMissing: true,
            setupRequired: true,
          };
          return { data: emptyAnalytics, status: 503 };
        }

        throw new AppError({
          type: ErrorType.DATABASE_QUERY_FAILED,
          message: `Failed to fetch analytics data: ${sessionsError.message}`,
          severity: ErrorSeverity.HIGH,
          context: {
            userId: user.id,
            metadata: {
              timeRange,
              districtFilter,
              schoolFilter,
              error: sessionsError.message,
            },
          },
        });
      }

      // Filter sessions to only include teachers and students for school-level analytics
      const filteredSessions =
        sessions?.filter((session: any) => {
          const role = session.user_profiles?.role;
          return role === "teacher" || role === "student";
        }) || [];

      // Calculate analytics (use all sessions for system-level, filtered for school-level)
      const analyticsSource = schoolFilter ? filteredSessions : sessions || [];
      const completedSessions = analyticsSource.filter(
        (s) => s.duration_minutes > 0
      );
      const totalSessions = analyticsSource.length;
      const uniqueUsers = new Set(analyticsSource.map((s) => s.user_id)).size;
      const totalMinutes = completedSessions.reduce(
        (sum, s) => sum + (s.duration_minutes || 0),
        0
      );
      const averageSessionMinutes =
        completedSessions.length > 0
          ? Math.round(totalMinutes / completedSessions.length)
          : 0;
      const totalPageViews = analyticsSource.reduce(
        (sum, s) => sum + (s.pages_visited || 0),
        0
      );
      const totalActions = analyticsSource.reduce(
        (sum, s) => sum + (s.actions_count || 0),
        0
      );

      // Get active users (last 15 minutes)
      const activeUsersQuery = supabase
        .from("user_sessions")
        .select("user_id")
        .eq("is_active", true)
        .gte(
          "last_activity",
          new Date(Date.now() - 15 * 60 * 1000).toISOString()
        );

      if (districtFilter) {
        activeUsersQuery.eq("district_id", districtFilter);
      }
      if (schoolFilter) {
        activeUsersQuery.eq("school_id", schoolFilter);
      }

      const { data: activeUsers } = await activeUsersQuery;
      const currentActiveUsers = new Set(
        activeUsers?.map((s) => s.user_id) || []
      ).size;

      // Group by role with more detailed breakdown
      const roleBreakdown = filteredSessions.reduce(
        (acc: any, session: any) => {
          const role = session.user_profiles?.role || "unknown";
          if (!acc[role]) {
            acc[role] = {
              count: 0,
              minutes: 0,
              sessions: 0,
              uniqueUsers: new Set(),
            };
          }
          acc[role].sessions += 1;
          acc[role].minutes += session.duration_minutes || 0;
          acc[role].uniqueUsers.add(session.user_id);
          return acc;
        },
        {}
      );

      // Convert uniqueUsers sets to counts
      Object.keys(roleBreakdown).forEach((role) => {
        roleBreakdown[role].count = roleBreakdown[role].uniqueUsers.size;
        delete roleBreakdown[role].uniqueUsers;
      });

      // Group by device type
      const deviceBreakdown =
        sessions?.reduce((acc: any, session) => {
          const device = session.device_type || "unknown";
          acc[device] = (acc[device] || 0) + 1;
          return acc;
        }, {}) || {};

      // School breakdown for district-level analytics
      const schoolBreakdown: any = {};
      if (districtFilter && !schoolFilter) {
        // Only show school breakdown for district-level view (not school-specific view)
        filteredSessions.forEach((session: any) => {
          const schoolId = session.school_id;
          const schoolName = session.schools?.name || "Unknown School";
          const role = session.user_profiles?.role;

          if (!schoolBreakdown[schoolId]) {
            schoolBreakdown[schoolId] = {
              name: schoolName,
              teachers: {
                users: new Set(),
                sessions: 0,
                minutes: 0,
              },
              students: {
                users: new Set(),
                sessions: 0,
                minutes: 0,
              },
              totals: {
                users: new Set(),
                sessions: 0,
                minutes: 0,
              },
            };
          }

          const school = schoolBreakdown[schoolId];
          school.totals.users.add(session.user_id);
          school.totals.sessions += 1;
          school.totals.minutes += session.duration_minutes || 0;

          if (role === "teacher") {
            school.teachers.users.add(session.user_id);
            school.teachers.sessions += 1;
            school.teachers.minutes += session.duration_minutes || 0;
          } else if (role === "student") {
            school.students.users.add(session.user_id);
            school.students.sessions += 1;
            school.students.minutes += session.duration_minutes || 0;
          }
        });

        // Convert sets to counts and format data
        Object.keys(schoolBreakdown).forEach((schoolId) => {
          const school = schoolBreakdown[schoolId];
          school.teachers.count = school.teachers.users.size;
          school.students.count = school.students.users.size;
          school.totals.count = school.totals.users.size;

          // Clean up sets
          delete school.teachers.users;
          delete school.students.users;
          delete school.totals.users;
        });
      }

      // Daily breakdown for the time range
      const dailyData = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dayStart = new Date(currentDate);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);

        const daySessions = analyticsSource.filter((s) => {
          const sessionDate = new Date(s.session_start);
          return sessionDate >= dayStart && sessionDate <= dayEnd;
        });

        const dayUniqueUsers = new Set(daySessions.map((s) => s.user_id)).size;
        const dayTotalMinutes = daySessions
          .filter((s) => s.duration_minutes > 0)
          .reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

        dailyData.push({
          date: currentDate.toISOString().split("T")[0],
          sessions: daySessions.length,
          uniqueUsers: dayUniqueUsers,
          totalMinutes: dayTotalMinutes,
          averageMinutes:
            daySessions.length > 0
              ? Math.round(
                  dayTotalMinutes /
                    daySessions.filter((s) => s.duration_minutes > 0).length
                ) || 0
              : 0,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Calculate totals by role for school analytics
      const teacherData = roleBreakdown.teacher || {
        count: 0,
        minutes: 0,
        sessions: 0,
      };
      const studentData = roleBreakdown.student || {
        count: 0,
        minutes: 0,
        sessions: 0,
      };

      const analytics = {
        summary: {
          totalSessions,
          uniqueUsers,
          currentActiveUsers,
          averageSessionMinutes,
          totalHours: Math.round(totalMinutes / 60),
          totalPageViews,
          totalActions,
          timeRange,
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
          // Add teacher/student totals for school analytics
          ...(schoolFilter && {
            teacherTotals: {
              users: teacherData.count,
              sessions: teacherData.sessions,
              totalHours: Math.round(teacherData.minutes / 60),
              totalMinutes: teacherData.minutes,
              averageMinutes:
                teacherData.sessions > 0
                  ? Math.round(teacherData.minutes / teacherData.sessions)
                  : 0,
            },
            studentTotals: {
              users: studentData.count,
              sessions: studentData.sessions,
              totalHours: Math.round(studentData.minutes / 60),
              totalMinutes: studentData.minutes,
              averageMinutes:
                studentData.sessions > 0
                  ? Math.round(studentData.minutes / studentData.sessions)
                  : 0,
            },
          }),
        },
        breakdown: {
          roles: roleBreakdown,
          devices: deviceBreakdown,
          ...(districtFilter &&
            !schoolFilter &&
            Object.keys(schoolBreakdown).length > 0 && {
              schools: schoolBreakdown,
            }),
        },
        daily: dailyData,
        scope: {
          level: schoolFilter
            ? "school"
            : districtFilter
            ? "district"
            : "system",
          districtId: districtFilter,
          schoolId: schoolFilter,
        },
      };

      return { data: analytics };
    },
    {
      operationName: "getAnalyticsDashboard",
      timeout: 30000,
      retries: 1,
      context: { metadata: { endpoint: "/api/analytics/dashboard" } },
    }
  );

  if (!result.success) {
    const error = result.error!;

    // Map error types to HTTP status codes
    let statusCode = 500;
    if (error.type === ErrorType.AUTHENTICATION_FAILED) {
      statusCode = 401;
    } else if (error.type === ErrorType.AUTHORIZATION_DENIED) {
      statusCode = 403;
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

  // Handle special case where tables are missing but we return empty data
  if (result.data?.status === 503) {
    return NextResponse.json(
      {
        error: "Analytics tables not set up",
        details: "Please run the analytics schema migration",
        hint: "Check migrations/create-analytics-schema.sql",
        ...result.data,
      },
      { status: 503 }
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}
