import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { districtId, adminId } = await request.json();

    if (!districtId || !adminId) {
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

    // Check if the admin exists and belongs to this district
    const { data: admin, error: adminError } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, email, role, district_id, metadata")
      .eq("id", adminId)
      .eq("district_id", districtId)
      .eq("role", "district_admin")
      .single();

    if (adminError || !admin) {
      return NextResponse.json(
        { error: "District administrator not found" },
        { status: 404 }
      );
    }

    // Check if this admin is the POC
    const wasPoc = admin.metadata?.is_poc === true;

    // Remove the admin by changing their role to a generic user or deleting
    // For safety, we'll change their role to null and remove district assignment
    const { error: removeError } = await supabase
      .from("user_profiles")
      .update({
        role: null,
        district_id: null,
        school_id: null,
        metadata: {},
      })
      .eq("id", adminId);

    if (removeError) {
      console.error("Error removing district admin:", removeError);
      return NextResponse.json(
        { error: "Failed to remove district administrator" },
        { status: 500 }
      );
    }

    // If this was the POC, we need to update the district's POC email
    if (wasPoc) {
      // Find another district admin to be the new POC
      const { data: otherAdmins, error: otherAdminsError } = await supabase
        .from("user_profiles")
        .select("id, email")
        .eq("district_id", districtId)
        .eq("role", "district_admin")
        .neq("id", adminId)
        .limit(1);

      if (otherAdminsError) {
        console.error("Error finding other admins:", otherAdminsError);
      } else if (otherAdmins && otherAdmins.length > 0) {
        // Set the first remaining admin as POC
        const newPoc = otherAdmins[0];

        const { error: newPocError } = await supabase
          .from("user_profiles")
          .update({ metadata: { is_poc: true } })
          .eq("id", newPoc.id);

        if (newPocError) {
          console.error("Error setting new POC:", newPocError);
        }

        // Update district POC email
        const { error: districtUpdateError } = await supabase
          .from("districts")
          .update({ poc_email: newPoc.email })
          .eq("id", districtId);

        if (districtUpdateError) {
          console.error(
            "Error updating district POC email:",
            districtUpdateError
          );
        }
      } else {
        // No other admins, clear the district POC email
        const { error: districtClearError } = await supabase
          .from("districts")
          .update({ poc_email: null })
          .eq("id", districtId);

        if (districtClearError) {
          console.error(
            "Error clearing district POC email:",
            districtClearError
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully removed ${admin.first_name} ${admin.last_name} as district administrator`,
    });
  } catch (error) {
    console.error("Error removing district admin:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
