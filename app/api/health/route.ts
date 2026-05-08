import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const districtId = request.headers.get("x-jswp-district-id");

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    district: districtId ?? null,
  });
}
