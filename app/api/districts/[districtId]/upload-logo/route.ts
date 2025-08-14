// app/api/districts/[districtId]/upload-logo/route.ts
import { createServerSupabaseClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ districtId: string }> }
) {
  try {
    const { districtId } = await params;

    if (!districtId) {
      return NextResponse.json({ error: "District ID required" }, { status: 400 });
    }

    // Create Supabase client with user session
    const cookieStore = await cookies();
    const supabase = await createServerSupabaseClient(cookieStore);

    // Get current user and verify they're authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Get user profile and verify permissions
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, district_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 403 });
    }

    // Check if user has permission to upload logo for this district
    const hasPermission = 
      profile.role === "super_admin" || 
      (profile.role === "district_admin" && profile.district_id === districtId);

    if (!hasPermission) {
      return NextResponse.json({ error: "Permission denied. Only super admins and district admins can upload logos." }, { status: 403 });
    }

    // Verify the district exists
    const { data: district, error: districtError } = await supabase
      .from("districts")
      .select("id, name")
      .eq("id", districtId)
      .single();

    if (districtError || !district) {
      return NextResponse.json({ error: "District not found" }, { status: 404 });
    }

    // Parse the uploaded file from form data
    const formData = await request.formData();
    const file = formData.get("logo") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 });
    }

    // Create Supabase admin client for storage operations
    const { createClient } = require('@supabase/supabase-js');
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Determine file extension
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'svg'];
    
    if (!allowedExtensions.includes(fileExt)) {
      return NextResponse.json({ 
        error: `Invalid file extension. Allowed: ${allowedExtensions.join(', ')}` 
      }, { status: 400 });
    }

    // Create the file path
    const fileName = `district-${districtId}/logo.${fileExt}`;

    // Convert file to buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Upload to storage using admin client
    const { data: uploadData, error: uploadError } = await adminSupabase.storage
      .from('district-logos')
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ 
        error: "Failed to upload logo to storage",
        details: uploadError.message 
      }, { status: 500 });
    }

    // Generate the API URL that will serve the logo
    const logoUrl = `/api/districts/${districtId}/logo`;

    // Update the district with the logo URL
    const { error: updateError } = await supabase
      .from('districts')
      .update({ logo_url: logoUrl })
      .eq('id', districtId);

    if (updateError) {
      console.error('Error updating district logo URL:', updateError);
      return NextResponse.json({ 
        error: "Failed to update district logo URL",
        details: updateError.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Logo uploaded successfully",
      logo_url: logoUrl,
      file_path: uploadData.path
    });

  } catch (error: any) {
    console.error("Error uploading district logo:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}