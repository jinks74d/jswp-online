// app/api/super-admin/districts/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";

// Admin client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: NextRequest) {
  try {
    console.log("API route called");

    // Verify the user is a super admin
    const cookieStore = await cookies();
    const supabase = await createServerSupabaseClient(cookieStore);

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    console.log("User check:", { user: user?.id, error: authError });

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile to verify role
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    console.log("Profile check:", { role: profile?.role, error: profileError });

    if (profileError || !profile || profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden - not super admin" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    console.log("Request body:", body);

    const { name, domain, pocEmail, pocFirstName, pocLastName, pocPassword } =
      body;

    // Validate required fields
    if (!name || !pocEmail || !pocFirstName || !pocLastName || !pocPassword) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate password length
    if (pocPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(pocEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Step 1: Create the district
    const { data: district, error: districtError } = await supabase
      .from("districts")
      .insert({
        name: name.trim(),
        domain: domain?.trim() || null,
        poc_email: pocEmail.trim(),
        settings: {},
      })
      .select()
      .single();

    console.log("District creation:", { district, error: districtError });

    if (districtError) {
      return NextResponse.json(
        {
          error: `Failed to create district: ${districtError.message}`,
        },
        { status: 500 }
      );
    }

    // Step 2: Create POC user account using admin client
    console.log("Creating POC user with admin client...");
    const { data: authData, error: authCreateError } =
      await supabaseAdmin.auth.admin.createUser({
        email: pocEmail.trim(),
        password: pocPassword,
        email_confirm: true, // Auto-confirm the email
      });

    console.log("User creation result:", {
      userId: authData?.user?.id,
      error: authCreateError,
    });

    if (authCreateError) {
      // Clean up district on error
      console.log("Cleaning up district due to user creation error");
      await supabase.from("districts").delete().eq("id", district.id);
      return NextResponse.json(
        {
          error: `Failed to create POC user: ${authCreateError.message}`,
        },
        { status: 500 }
      );
    }

    if (!authData.user) {
      await supabase.from("districts").delete().eq("id", district.id);
      return NextResponse.json(
        {
          error: "No user returned from user creation",
        },
        { status: 500 }
      );
    }

    // Step 3: Create user profile for POC
    console.log("Creating user profile...");
    const { error: profileCreateError } = await supabase
      .from("user_profiles")
      .insert({
        id: authData.user.id,
        district_id: district.id,
        school_id: null,
        role: "district_admin",
        first_name: pocFirstName.trim(),
        last_name: pocLastName.trim(),
        email: pocEmail.trim(),
        metadata: {
          is_poc: true,
          created_by_super_admin: true,
        },
      });

    console.log("Profile creation result:", { error: profileCreateError });

    if (profileCreateError) {
      // Clean up on error
      console.log(
        "Cleaning up user and district due to profile creation error"
      );
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabase.from("districts").delete().eq("id", district.id);
      return NextResponse.json(
        {
          error: `Failed to create user profile: ${profileCreateError.message}`,
        },
        { status: 500 }
      );
    }

    console.log("District and POC created successfully!");

    // Return success
    return NextResponse.json({
      success: true,
      district: {
        id: district.id,
        name: district.name,
        domain: district.domain,
        poc_email: district.poc_email,
      },
      pocUser: {
        id: authData.user.id,
        email: authData.user.email,
      },
    });
  } catch (error: any) {
    console.error("District creation error:", error);
    return NextResponse.json(
      {
        error: `Server error: ${error.message}`,
      },
      { status: 500 }
    );
  }
}
