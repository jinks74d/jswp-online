// app/api/districts/[districtId]/logo/route.ts
import { createServerSupabaseClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ districtId: string }> }
) {
  try {
    const { districtId } = await params;

    if (!districtId) {
      return NextResponse.json({ error: "District ID required" }, { status: 400 });
    }

    // Create Supabase client
    const cookieStore = await cookies();
    const supabase = await createServerSupabaseClient(cookieStore);

    // Get district info to verify it exists
    const { data: district, error: districtError } = await supabase
      .from("districts")
      .select("id, name, logo_url")
      .eq("id", districtId)
      .single();

    if (districtError || !district) {
      return NextResponse.json({ error: "District not found" }, { status: 404 });
    }

    // Try different file extensions to find the logo
    const extensions = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
    let logoData = null;
    let contentType = 'image/png';

    for (const ext of extensions) {
      const filePath = `district-${districtId}/logo.${ext}`;
      
      const { data, error } = await supabase.storage
        .from('district-logos')
        .download(filePath);

      if (!error && data) {
        logoData = data;
        contentType = data.type || `image/${ext}`;
        break;
      }
    }

    if (!logoData) {
      return NextResponse.json({ error: "Logo file not found in storage" }, { status: 404 });
    }

    // Convert blob to array buffer
    const arrayBuffer = await logoData.arrayBuffer();

    // Return the image with proper headers
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
        'Content-Disposition': `inline; filename="district-${districtId}-logo"`,
      },
    });

  } catch (error: any) {
    console.error("Error serving district logo:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}