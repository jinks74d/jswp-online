// app/api/districts/[districtId]/logo/route.ts
//
// Resolves a district's logo to a redirect rather than proxying bytes.
//
// This used to download from the `district-logos` storage bucket, probing five
// extensions in turn, and stream the result. Two problems with that:
//
//  1. Nothing in the app ever writes to that bucket. `districts.logo_url` is a
//     free-form URL column set from the district form, and it is what
//     middleware.ts and districts-browser.tsx already read. The bucket held
//     zero objects, so this route returned 404 for every district that had a
//     perfectly good logo_url — the logo component fell back to initials.
//  2. It used the RLS-respecting server client, so `.download()` depended on
//     the broad `district_logos_public_read` SELECT policy on storage.objects
//     — the policy Supabase's linter flags for allowing clients to list the
//     whole bucket. That policy cannot be narrowed, because list() and
//     download() are the same SELECT; the dependency had to go first.
//
// Redirecting to logo_url fixes both. Migration 0047 drops the policy.

import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/** Short enough that a branding change shows up promptly; long enough to
 *  keep a page full of logos from re-querying on every render. */
const CACHE_CONTROL = "public, max-age=300, s-maxage=300";

function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ districtId: string }> }
) {
  try {
    const { districtId } = await params;

    if (!districtId) {
      return NextResponse.json(
        { error: "District ID required" },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();
    const { data: district, error } = await supabase
      .from("districts")
      .select("logo_url")
      .eq("id", districtId)
      .maybeSingle();

    if (error) {
      console.error("Error reading district for logo:", error.message);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    // maybeSingle() returns null both for "no such district" and for one the
    // caller cannot read under RLS. Neither is worth distinguishing here.
    if (!district) return notFound("District not found");
    if (!district.logo_url) return notFound("District has no logo");

    // districts.logo_url carries a CHECK for '^https?://' (migration 0001), but
    // re-validate: the constraint post-dates nothing here, and service-role
    // writes bypass nothing at all — an unparseable value would make
    // NextResponse.redirect throw and turn a missing logo into a 500.
    let target: URL;
    try {
      target = new URL(district.logo_url);
    } catch {
      console.error(
        `District ${districtId} has an unparseable logo_url; ignoring.`
      );
      return notFound("District has no usable logo");
    }
    if (target.protocol !== "https:" && target.protocol !== "http:") {
      return notFound("District has no usable logo");
    }

    // 307, not 301: logo_url is editable, and a permanent redirect would be
    // cached by browsers past any change to it.
    const response = NextResponse.redirect(target, 307);
    response.headers.set("Cache-Control", CACHE_CONTROL);
    return response;
  } catch (error: unknown) {
    console.error("Error serving district logo:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
