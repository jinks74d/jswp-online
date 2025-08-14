import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { districtId, adminId, isPoc } = await request.json();

    if (!districtId || !adminId || typeof isPoc !== "boolean") {
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
      .select("id, first_name, last_name, email, role, district_id")
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

    if (isPoc) {
      // Setting as POC - remove POC status from all other admins in this district
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
        return NextResponse.json(
          { error: "Failed to update POC status" },
          { status: 500 }
        );
      }

      // Set this admin as POC
      const { error: setPocError } = await supabase
        .from("user_profiles")
        .update({ metadata: { is_poc: true } })
        .eq("id", adminId);

      if (setPocError) {
        console.error("Error setting POC status:", setPocError);
        return NextResponse.json(
          { error: "Failed to set POC status" },
          { status: 500 }
        );
      }

      // Update district POC email
      const { error: districtUpdateError } = await supabase
        .from("districts")
        .update({ poc_email: admin.email })
        .eq("id", districtId);

      if (districtUpdateError) {
        console.error(
          "Error updating district POC email:",
          districtUpdateError
        );
        return NextResponse.json(
          { error: "Failed to update district POC email" },
          { status: 500 }
        );
      }
    } else {
      // Removing POC status
      const { error: removePocError } = await supabase
        .from("user_profiles")
        .update({ metadata: {} })
        .eq("id", adminId);

      if (removePocError) {
        console.error("Error removing POC status:", removePocError);
        return NextResponse.json(
          { error: "Failed to remove POC status" },
          { status: 500 }
        );
      }

      // Find another admin to be POC or clear district POC
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
      message: `Successfully ${isPoc ? "set" : "removed"} ${admin.first_name} ${
        admin.last_name
      } as POC`,
    });
  } catch (error) {
    console.error("Error toggling POC status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
