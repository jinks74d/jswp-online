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
            } catch {
              // The `setAll` method was called from a Server Component.
            }
          },
        },
      }
    );

    const results: any = {
      tablesExist: false,
      userSessions: null,
      currentUser: null,
      errors: []
    };

    // Get current user
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (user) {
        results.currentUser = {
          id: user.id,
          email: user.email
        };
      }
      if (userError) {
        results.errors.push(`User error: ${userError.message}`);
      }
    } catch (error: any) {
      results.errors.push(`Auth error: ${error.message}`);
    }

    // Check if user_sessions table exists by trying to select from it
    try {
      const { data: sessions, error: sessionsError } = await supabase
        .from('user_sessions')
        .select('id, user_id, session_start, is_active')
        .limit(5);

      if (sessionsError) {
        results.errors.push(`Sessions table error: ${sessionsError.message}`);
        results.tablesExist = false;
      } else {
        results.tablesExist = true;
        results.userSessions = {
          count: sessions?.length || 0,
          samples: sessions || []
        };
      }
    } catch (error: any) {
      results.errors.push(`Sessions query error: ${error.message}`);
    }

    // Check user profile if we have a user
    if (results.currentUser) {
      try {
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', results.currentUser.id)
          .single();

        if (profileError) {
          results.errors.push(`Profile error: ${profileError.message}`);
        } else {
          results.currentUser.profile = profile;
        }
      } catch (error: any) {
        results.errors.push(`Profile query error: ${error.message}`);
      }
    }

    // Test if we can insert a test session (then delete it)
    if (results.currentUser && results.tablesExist) {
      try {
        const testSession = {
          user_id: results.currentUser.id,
          district_id: results.currentUser.profile?.district_id,
          school_id: results.currentUser.profile?.school_id,
          session_start: new Date().toISOString(),
          last_activity: new Date().toISOString(),
          ip_address: '127.0.0.1',
          user_agent: 'test',
          device_type: 'desktop',
          is_active: true
        };

        const { data: insertResult, error: insertError } = await supabase
          .from('user_sessions')
          .insert(testSession)
          .select('id')
          .single();

        if (insertError) {
          results.errors.push(`Insert test failed: ${insertError.message}`);
          results.canInsert = false;
        } else {
          results.canInsert = true;
          
          // Clean up test session
          await supabase
            .from('user_sessions')
            .delete()
            .eq('id', insertResult.id);
        }
      } catch (error: any) {
        results.errors.push(`Insert test error: ${error.message}`);
        results.canInsert = false;
      }
    }

    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    console.error("Error in analytics check:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error },
      { status: 500 }
    );
  }
}