// app/api/super-admin/districts/[id]/route.ts
import { createServerSupabaseClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "District ID required" }, { status: 400 });
    }

    // Create Supabase client
    const cookieStore = await cookies();
    const supabase = await createServerSupabaseClient(cookieStore);

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile to verify role
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden - not super admin" },
        { status: 403 }
      );
    }

    // Check if district exists and get related data counts
    const { data: district, error: districtError } = await supabase
      .from("districts")
      .select("id, name")
      .eq("id", id)
      .single();

    if (districtError || !district) {
      return NextResponse.json({ error: "District not found" }, { status: 404 });
    }

    // Check for related data that would prevent deletion
    const [schoolsCount, usersCount] = await Promise.all([
      supabase
        .from("schools")
        .select("*", { count: "exact", head: true })
        .eq("district_id", id),
      supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .eq("district_id", id)
    ]);

    // Prevent deletion if district has schools or users
    if (schoolsCount.count && schoolsCount.count > 0) {
      return NextResponse.json({
        error: `Cannot delete district. It has ${schoolsCount.count} school(s) that must be removed first.`,
        canDelete: false,
        schoolsCount: schoolsCount.count,
        usersCount: usersCount.count || 0
      }, { status: 400 });
    }

    if (usersCount.count && usersCount.count > 0) {
      return NextResponse.json({
        error: `Cannot delete district. It has ${usersCount.count} user(s) that must be removed first.`,
        canDelete: false,
        schoolsCount: schoolsCount.count || 0,
        usersCount: usersCount.count
      }, { status: 400 });
    }

    // Delete the district (safe to delete as it has no related data)
    const { error: deleteError } = await supabase
      .from("districts")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting district:", deleteError);
      return NextResponse.json({
        error: `Failed to delete district: ${deleteError.message}`
      }, { status: 500 });
    }

    // Clean up district logo from storage if it exists
    try {
      await supabase.storage
        .from('district-logos')
        .remove([`district-${id}/logo.png`, `district-${id}/logo.jpg`, `district-${id}/logo.jpeg`, `district-${id}/logo.webp`, `district-${id}/logo.svg`]);
    } catch (storageError) {
      console.warn("Error cleaning up district logo:", storageError);
      // Don't fail the deletion if logo cleanup fails
    }

    return NextResponse.json({
      success: true,
      message: `District "${district.name}" has been successfully deleted.`
    });

  } catch (error: any) {
    console.error("District deletion error:", error);
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}