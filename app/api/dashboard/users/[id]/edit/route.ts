// app/api/dashboard/users/[id]/edit/route.ts
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

interface RouteContext {
  params: { id: string };
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    console.log("User update API called for user:", params.id);

    // Verify the user has permission
    const cookieStore = await cookies();
    const supabase = await createServerSupabaseClient(cookieStore);

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    console.log("Current user check:", { user: user?.id, error: authError });

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user profile to verify role and district
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, district_id, school_id")
      .eq("id", user.id)
      .single();

    console.log("Current user profile:", {
      role: profile?.role,
      districtId: profile?.district_id,
      error: profileError,
    });

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    // Only district_admin and school_admin can edit users
    if (!["district_admin", "school_admin"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Get the user to be edited
    const { data: userToEdit, error: userToEditError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", params.id)
      .eq("district_id", profile.district_id) // Ensure user belongs to same district
      .single();

    if (userToEditError || !userToEdit) {
      return NextResponse.json(
        { error: "User not found or access denied" },
        { status: 404 }
      );
    }

    // For school admins, additional restrictions
    if (profile.role === "school_admin") {
      // Can't edit district admins
      if (userToEdit.role === "district_admin") {
        return NextResponse.json(
          { error: "School admins cannot edit district administrators" },
          { status: 403 }
        );
      }
      // Can only edit users from their school or unassigned users
      if (userToEdit.school_id && userToEdit.school_id !== profile.school_id) {
        return NextResponse.json(
          { error: "School admins can only edit users from their own school" },
          { status: 403 }
        );
      }
    }

    // Parse request body
    const body = await request.json();
    console.log("Update request body:", body);

    const { firstName, lastName, email, role, schoolId, newPassword } = body;

    // Validate required fields
    if (!email || !firstName || !lastName || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
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
    if (role === "school_admin" && !schoolId) {
      return NextResponse.json(
        { error: "School is required for School Administrators" },
        { status: 400 }
      );
    }

    // Validate password length if provided
    if (newPassword && newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // For school admins, validate role changes
    if (profile.role === "school_admin") {
      if (role === "district_admin") {
        return NextResponse.json(
          { error: "School admins cannot assign district administrator role" },
          { status: 403 }
        );
      }
      // If assigning to a school, must be their own school
      if (schoolId && profile.school_id !== schoolId) {
        return NextResponse.json(
          { error: "School admins can only assign users to their own school" },
          { status: 403 }
        );
      }
    }

    // Verify school exists and belongs to district (if schoolId provided)
    if (schoolId) {
      const { data: school, error: schoolError } = await supabase
        .from("schools")
        .select("id, district_id")
        .eq("id", schoolId)
        .eq("district_id", profile.district_id)
        .single();

      if (schoolError || !school) {
        return NextResponse.json(
          { error: "Invalid school selection" },
          { status: 400 }
        );
      }
    }

    // Step 1: Update user profile
    console.log("Updating user profile...");
    const { error: profileUpdateError } = await supabase
      .from("user_profiles")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        role: role,
        school_id: schoolId || null,
      })
      .eq("id", params.id);

    console.log("Profile update result:", { error: profileUpdateError });

    if (profileUpdateError) {
      return NextResponse.json(
        {
          error: `Failed to update user profile: ${profileUpdateError.message}`,
        },
        { status: 500 }
      );
    }

    // Step 2: Update auth user email if changed
    if (email.trim() !== userToEdit.email) {
      console.log("Updating auth user email...");
      const { error: emailUpdateError } =
        await supabaseAdmin.auth.admin.updateUserById(params.id, {
          email: email.trim(),
        });

      if (emailUpdateError) {
        console.error("Failed to update auth email:", emailUpdateError);
        // Don't fail the entire operation for email update errors
      }
    }

    // Step 3: Update password if provided
    if (newPassword) {
      console.log("Updating user password...");
      const { error: passwordUpdateError } =
        await supabaseAdmin.auth.admin.updateUserById(params.id, {
          password: newPassword,
        });

      console.log("Password update result:", { error: passwordUpdateError });

      if (passwordUpdateError) {
        return NextResponse.json(
          {
            error: `Failed to update password: ${passwordUpdateError.message}`,
          },
          { status: 500 }
        );
      }
    }

    console.log("User updated successfully!");

    // Return success
    return NextResponse.json({
      success: true,
      user: {
        id: params.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        role: role,
        schoolId: schoolId,
        passwordUpdated: !!newPassword,
      },
    });
  } catch (error: any) {
    console.error("User update error:", error);
    return NextResponse.json(
      {
        error: `Server error: ${error.message}`,
      },
      { status: 500 }
    );
  }
}
