// app/api/districts/[districtId]/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ districtId: string }> }
) {
  try {
    const { districtId } = await params;
    console.log('PUT /api/districts/[districtId]/settings - districtId:', districtId);
    
    const cookieStore = await cookies();
    const supabase = await createServerSupabaseClient(cookieStore);

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.log('Authentication failed:', userError?.message || 'No user');
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    console.log('User authenticated:', user.email);

    // Get user profile to verify they're a district admin
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, district_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.log('Profile error:', profileError?.message || 'No profile found');
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }
    
    console.log('User profile:', { role: profile.role, district_id: profile.district_id });

    // Verify user has permission to modify this district
    const hasPermission = 
      profile.role === "super_admin" || 
      (profile.role === "district_admin" && profile.district_id === districtId);
    
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Unauthorized to modify this district" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, domain, poc_email, primary_color, secondary_color } = body;

    // Validate required fields
    if (!name?.trim() || !poc_email?.trim()) {
      return NextResponse.json(
        { error: "District name and contact email are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(poc_email.trim())) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    // Validate domain format (if provided)
    if (domain?.trim()) {
      const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
      if (!domainRegex.test(domain.trim())) {
        return NextResponse.json(
          { error: "Please enter a valid domain name" },
          { status: 400 }
        );
      }
    }

    // First verify the district exists and user has access
    const { data: existingDistrict, error: checkError } = await supabase
      .from("districts")
      .select("id, name")
      .eq("id", districtId)
      .single();

    if (checkError || !existingDistrict) {
      console.error("District not found:", checkError);
      return NextResponse.json(
        { error: "District not found" },
        { status: 404 }
      );
    }

    // Update district information using service role for RLS bypass
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

    const { data, error } = await adminSupabase
      .from("districts")
      .update({
        name: name.trim(),
        domain: domain?.trim() || null,
        poc_email: poc_email.trim(),
        primary_color: primary_color || "#3B82F6",
        secondary_color: secondary_color || "#64748B",
        updated_at: new Date().toISOString(),
      })
      .eq("id", districtId)
      .select()
      .single();

    if (error) {
      console.error("Database update error:", error);
      return NextResponse.json(
        { error: "Failed to update district settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "District settings updated successfully",
      district: data,
    });

  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ districtId: string }> }
) {
  try {
    const { districtId } = await params;
    const cookieStore = await cookies();
    const supabase = await createServerSupabaseClient(cookieStore);

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user profile to verify they have access to this district
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, district_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Verify user has access to this district
    const hasAccess = 
      profile.role === "super_admin" || 
      profile.district_id === districtId;
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Unauthorized to access this district" },
        { status: 403 }
      );
    }

    // Get district information
    const { data: district, error } = await supabase
      .from("districts")
      .select("*")
      .eq("id", districtId)
      .single();

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "District not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      district,
    });

  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
