import { createServerSupabaseClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const districtId = searchParams.get('districtId');

    if (!districtId) {
      return NextResponse.json({ error: "District ID required" }, { status: 400 });
    }

    // Create Supabase client
    const cookieStore = await cookies();
    const supabase = await createServerSupabaseClient(cookieStore);

    // Check if district exists in database
    const { data: district, error: districtError } = await supabase
      .from("districts")
      .select("*")
      .eq("id", districtId)
      .single();

    console.log('Debug - District query result:', { district, districtError });

    if (districtError) {
      return NextResponse.json({
        error: "District query failed",
        details: districtError,
        districtId
      }, { status: 400 });
    }

    if (!district) {
      return NextResponse.json({
        error: "District not found",
        districtId
      }, { status: 404 });
    }

    // Check storage bucket
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    console.log('Debug - Available buckets:', buckets);

    // Check if district-logos bucket exists
    const districtLogoBucket = buckets?.find(bucket => bucket.name === 'district-logos');
    
    if (!districtLogoBucket) {
      return NextResponse.json({
        error: "district-logos bucket not found",
        availableBuckets: buckets?.map(b => b.name) || [],
        district
      }, { status: 500 });
    }

    // List files in the district folder
    const { data: files, error: filesError } = await supabase.storage
      .from('district-logos')
      .list(`district-${districtId}`, {
        limit: 100
      });

    console.log('Debug - Files in district folder:', files);

    // Try to find logo files
    const extensions = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
    const logoAttempts = [];

    for (const ext of extensions) {
      const filePath = `district-${districtId}/logo.${ext}`;
      
      const { data, error } = await supabase.storage
        .from('district-logos')
        .download(filePath);

      logoAttempts.push({
        extension: ext,
        filePath,
        success: !error,
        error: error?.message,
        fileSize: data ? data.size : null
      });

      if (!error && data) {
        break;
      }
    }

    return NextResponse.json({
      success: true,
      district,
      bucket: districtLogoBucket,
      filesInFolder: files || [],
      filesError,
      logoAttempts,
      expectedFolderPath: `district-${districtId}/`
    });

  } catch (error: any) {
    console.error("Debug endpoint error:", error);
    return NextResponse.json({
      error: "Debug endpoint failed",
      details: error.message
    }, { status: 500 });
  }
}
