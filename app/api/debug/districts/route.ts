import { createServerSupabaseClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    // Create Supabase client
    const cookieStore = await cookies();
    const supabase = await createServerSupabaseClient(cookieStore);

    // Get all districts with basic info
    const { data: districts, error: districtsError } = await supabase
      .from("districts")
      .select("id, name, domain, logo_url, primary_color, secondary_color, created_at")
      .limit(10);

    if (districtsError) {
      return NextResponse.json({
        error: "Failed to fetch districts",
        details: districtsError
      }, { status: 500 });
    }

    // Check storage buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    const districtLogoBucket = buckets?.find(bucket => bucket.name === 'district-logos');

    // For each district, check if logo files exist
    const districtInfo = [];
    
    if (districts) {
      for (const district of districts) {
        const info: any = {
          ...district,
          logoFiles: [],
          logoTestResults: []
        };

        if (districtLogoBucket) {
          // List files in district folder
          const { data: files, error: filesError } = await supabase.storage
            .from('district-logos')
            .list(`district-${district.id}`, { limit: 20 });

          info.logoFiles = files || [];
          info.filesError = filesError?.message;

          // Test common logo file paths
          const extensions = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
          for (const ext of extensions) {
            const filePath = `district-${district.id}/logo.${ext}`;
            const { data, error } = await supabase.storage
              .from('district-logos')
              .download(filePath);

            info.logoTestResults.push({
              extension: ext,
              filePath,
              exists: !error && data,
              error: error?.message,
              fileSize: data ? data.size : null
            });
          }
        }

        districtInfo.push(info);
      }
    }

    return NextResponse.json({
      success: true,
      districtsCount: districts?.length || 0,
      districts: districtInfo,
      buckets: buckets?.map(b => ({ name: b.name, id: b.id })) || [],
      districtLogoBucketExists: !!districtLogoBucket,
      bucketsError: bucketsError?.message
    });

  } catch (error: any) {
    console.error("Debug districts endpoint error:", error);
    return NextResponse.json({
      error: "Debug endpoint failed",
      details: error.message
    }, { status: 500 });
  }
}
