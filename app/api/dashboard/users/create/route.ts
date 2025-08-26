// app/api/dashboard/users/create/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";

// Admin client with service role key - only create if environment variables are available
const createSupabaseAdmin = () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
};

export async function POST(request: NextRequest) {
  try {
    console.log("User creation API called");

    // Verify the user has permission
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

    // Get user profile to verify role and district
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, district_id, school_id")
      .eq("id", user.id)
      .single();

    console.log("Profile check:", {
      role: profile?.role,
      districtId: profile?.district_id,
      error: profileError,
    });

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    // Only district_admin, school_admin, and teacher can create users
    if (!["district_admin", "school_admin", "teacher"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    console.log("Request body:", body);

    const { email, firstName, lastName, role, schoolId, password, districtId } =
      body;

    // Validate required fields
    if (!email || !firstName || !lastName || !role || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate district access
    if (profile.district_id !== districtId) {
      return NextResponse.json(
        { error: "Cannot create users for other districts" },
        { status: 403 }
      );
    }

    // Validate school access for school admins and teachers
    if (profile.role === "school_admin") {
      // School admins can only create users for their own school (if school is specified)
      if (schoolId && profile.school_id !== schoolId) {
        return NextResponse.json(
          { error: "School admins can only create users for their own school" },
          { status: 403 }
        );
      }
      // School admins cannot create district admins
      if (role === "district_admin") {
        return NextResponse.json(
          { error: "School admins cannot create district administrators" },
          { status: 403 }
        );
      }
    }

    // Teachers can only create students for their own school
    if (profile.role === "teacher") {
      // Teachers can only create students
      if (role !== "student") {
        return NextResponse.json(
          { error: "Teachers can only create student accounts" },
          { status: 403 }
        );
      }
      // Teachers must create students for their own school
      if (!profile.school_id || schoolId !== profile.school_id) {
        return NextResponse.json(
          { error: "Teachers can only create students for their own school" },
          { status: 403 }
        );
      }
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate school requirement for certain roles
    if ((role === "school_admin" || role === "student") && !schoolId) {
      return NextResponse.json(
        {
          error:
            role === "school_admin"
              ? "School is required for School Administrators"
              : "School is required for Students",
        },
        { status: 400 }
      );
    }

    // Verify school exists and belongs to district
    if (schoolId) {
      const { data: school, error: schoolError } = await supabase
        .from("schools")
        .select("id, district_id")
        .eq("id", schoolId)
        .eq("district_id", districtId)
        .single();

      if (schoolError || !school) {
        return NextResponse.json(
          { error: "Invalid school selection" },
          { status: 400 }
        );
      }
    }

    // Step 1: Create user account using admin client
    console.log("Creating user account with admin client...");
    let authData, authCreateError;
    try {
      const supabaseAdmin = createSupabaseAdmin();
      const result = await supabaseAdmin.auth.admin.createUser({
        email: email.trim(),
        password: password,
        email_confirm: true, // Auto-confirm the email
      });
      authData = result.data;
      authCreateError = result.error;
    } catch (error) {
      console.error("Failed to create admin client:", error);
      return NextResponse.json(
        {
          error: "Admin operations not configured",
        },
        { status: 500 }
      );
    }

    console.log("User creation result:", {
      userId: authData?.user?.id,
      error: authCreateError,
    });

    if (authCreateError) {
      return NextResponse.json(
        {
          error: `Failed to create user account: ${authCreateError.message}`,
        },
        { status: 500 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        {
          error: "No user returned from user creation",
        },
        { status: 500 }
      );
    }

    // Step 2: Create user profile
    console.log("Creating user profile...");
    const { error: profileCreateError } = await supabase
      .from("user_profiles")
      .insert({
        id: authData.user.id,
        district_id: districtId,
        school_id: schoolId || null,
        role: role,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        metadata: {
          created_by: user.id,
          created_by_role: profile.role,
        },
      });

    console.log("Profile creation result:", { error: profileCreateError });

    if (profileCreateError) {
      // Clean up auth user on error
      console.log("Cleaning up user due to profile creation error");
      try {
        const supabaseAdmin = createSupabaseAdmin();
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      } catch (error) {
        console.error("Failed to cleanup user:", error);
      }
      return NextResponse.json(
        {
          error: `Failed to create user profile: ${profileCreateError.message}`,
        },
        { status: 500 }
      );
    }

    console.log("User created successfully!");

    // Return success
    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: role,
        schoolId: schoolId,
        districtId: districtId,
      },
    });
  } catch (error: any) {
    console.error("User creation error:", error);
    return NextResponse.json(
      {
        error: `Server error: ${error.message}`,
      },
      { status: 500 }
    );
  }
}
