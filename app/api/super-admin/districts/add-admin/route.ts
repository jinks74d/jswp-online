import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { districtId, email, firstName, lastName, isPoc } =
      await request.json();

    if (!districtId || !email || !firstName || !lastName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

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

    // Verify the current user is a super admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if district exists
    const { data: district, error: districtError } = await supabase
      .from("districts")
      .select("id, name")
      .eq("id", districtId)
      .single();

    if (districtError || !district) {
      return NextResponse.json(
        { error: "District not found" },
        { status: 404 }
      );
    }

    // Check if user already exists with this email
    const { data: existingUser, error: existingUserError } = await supabase
      .from("user_profiles")
      .select("id, role, district_id")
      .eq("email", email.toLowerCase())
      .single();

    if (existingUserError && existingUserError.code !== "PGRST116") {
      console.error("Error checking existing user:", existingUserError);
      return NextResponse.json(
        { error: "Failed to check existing user" },
        { status: 500 }
      );
    }

    let adminId: string;

    if (existingUser) {
      // User exists - update their role and district
      if (
        existingUser.district_id === districtId &&
        existingUser.role === "district_admin"
      ) {
        return NextResponse.json(
          {
            error: "User is already a district administrator for this district",
          },
          { status: 400 }
        );
      }

      // Update existing user
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({
          role: "district_admin",
          district_id: districtId,
          first_name: firstName,
          last_name: lastName,
          metadata: isPoc ? { is_poc: true } : {},
        })
        .eq("id", existingUser.id);

      if (updateError) {
        console.error("Error updating existing user:", updateError);
        return NextResponse.json(
          { error: "Failed to update user role" },
          { status: 500 }
        );
      }

      adminId = existingUser.id;
    } else {
      // Create new user profile (they'll need to sign up later)
      const { data: newUser, error: createError } = await supabase
        .from("user_profiles")
        .insert({
          email: email.toLowerCase(),
          first_name: firstName,
          last_name: lastName,
          role: "district_admin",
          district_id: districtId,
          metadata: isPoc ? { is_poc: true } : {},
        })
        .select("id")
        .single();

      if (createError) {
        console.error("Error creating new user:", createError);
        return NextResponse.json(
          { error: "Failed to create district administrator" },
          { status: 500 }
        );
      }

      adminId = newUser.id;
    }

    // If this admin is being set as POC, remove POC status from other admins
    if (isPoc) {
      const { error: removePocError } = await supabase
        .from("user_profiles")
        .update({ metadata: {} })
        .eq("district_id", districtId)
        .eq("role", "district_admin")
        .neq("id", adminId);

      if (removePocError) {
        console.error(
          "Error removing POC status from other admins:",
          removePocError
        );
        // Don't fail the request for this, just log it
      }

      // Update district POC email
      const { error: districtUpdateError } = await supabase
        .from("districts")
        .update({ poc_email: email.toLowerCase() })
        .eq("id", districtId);

      if (districtUpdateError) {
        console.error(
          "Error updating district POC email:",
          districtUpdateError
        );
        // Don't fail the request for this, just log it
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully added ${firstName} ${lastName} as district administrator`,
      adminId,
    });
  } catch (error) {
    console.error("Error adding district admin:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
