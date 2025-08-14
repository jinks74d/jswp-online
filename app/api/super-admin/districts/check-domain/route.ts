// app/api/super-admin/districts/check-domain/route.ts
import { createServerSupabaseClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    // Verify the user is a super admin
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

    // Parse request body
    const body = await request.json();
    const { domain, excludeDistrictId } = body;

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json(
        { error: "Domain is required" },
        { status: 400 }
      );
    }

    const trimmedDomain = domain.trim();

    // Basic domain validation
    if (!trimmedDomain.includes('.')) {
      return NextResponse.json(
        { error: "Invalid domain format" },
        { status: 400 }
      );
    }

    // Check if domain already exists (excluding current district if provided)
    let query = supabase
      .from("districts")
      .select("id, name")
      .eq("domain", trimmedDomain);
    
    if (excludeDistrictId) {
      query = query.neq("id", excludeDistrictId);
    }
    
    const { data: existingDistrict, error: checkError } = await query.maybeSingle();

    if (checkError) {
      console.error("Domain check error:", checkError);
      return NextResponse.json(
        { error: "Error checking domain availability" },
        { status: 500 }
      );
    }

    const available = !existingDistrict;

    return NextResponse.json({
      available,
      domain: trimmedDomain,
      ...(existingDistrict && {
        existingDistrict: {
          id: existingDistrict.id,
          name: existingDistrict.name
        }
      })
    });

  } catch (error: any) {
    console.error("Domain check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}