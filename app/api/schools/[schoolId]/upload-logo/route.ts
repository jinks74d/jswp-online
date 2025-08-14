// app/api/schools/[schoolId]/upload-logo/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ schoolId: string }> }
) {
  try {
    const { schoolId } = await params;

    const cookieStore = await cookies();
    const supabase = await createServerSupabaseClient(cookieStore);

    // Get current user session for permission check
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user profile to check permissions
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, school_id, district_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 403 }
      );
    }

    // Check if user has permission to update this school
    const canUpdate = 
      profile.role === "super_admin" ||
      (profile.role === "school_admin" && profile.school_id === schoolId) ||
      (profile.role === "district_admin" && profile.district_id);

    if (!canUpdate) {
      return NextResponse.json(
        { error: "Insufficient permissions to upload school logo" },
        { status: 403 }
      );
    }

    // Verify school exists and user has access
    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("id, district_id, logo_url")
      .eq("id", schoolId)
      .single();

    if (schoolError || !school) {
      return NextResponse.json(
        { error: "School not found" },
        { status: 404 }
      );
    }

    // For district admins, verify they can access this school's district
    if (profile.role === "district_admin" && profile.district_id !== school.district_id) {
      return NextResponse.json(
        { error: "Insufficient permissions to update this school" },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("logo") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No logo file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload JPEG, PNG, GIF, WebP, or SVG files only." },
        { status: 400 }
      );
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop() || 'png';
    const fileName = `school-${schoolId}-logo-${timestamp}-${randomString}.${fileExtension}`;
    const filePath = `school-logos/${fileName}`;

    // Convert file to array buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("district-logos")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload logo to storage" },
        { status: 500 }
      );
    }

    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from("district-logos")
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      return NextResponse.json(
        { error: "Failed to get logo URL" },
        { status: 500 }
      );
    }

    // Delete old logo if it exists
    if (school.logo_url) {
      try {
        // Extract file path from old URL
        const oldPath = school.logo_url.split('/').slice(-2).join('/');
        await supabase.storage
          .from("district-logos")
          .remove([oldPath]);
      } catch (error) {
        console.warn("Failed to delete old logo:", error);
        // Continue anyway - not critical
      }
    }

    // Update school with new logo URL
    const { data: updatedSchool, error: updateError } = await supabase
      .from("schools")
      .update({
        logo_url: urlData.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", schoolId)
      .select()
      .single();

    if (updateError) {
      console.error("Database update error:", updateError);
      
      // Try to clean up uploaded file
      try {
        await supabase.storage
          .from("district-logos")
          .remove([filePath]);
      } catch (cleanupError) {
        console.warn("Failed to cleanup uploaded file:", cleanupError);
      }

      return NextResponse.json(
        { error: "Failed to update school with new logo" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "School logo uploaded successfully",
      logoUrl: urlData.publicUrl,
      school: updatedSchool
    });

  } catch (error) {
    console.error("School logo upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}