import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import { createAdminClient } from "@/lib/supabase/admin";

/* ─── Subdomain → district cache (60s TTL) ────────────────────────────── */

type DistrictBranding = {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
};

const CACHE_TTL_MS = 60_000;
const subdomainCache = new Map<
  string,
  { branding: DistrictBranding | null; cachedAt: number }
>();

async function resolveSubdomain(
  subdomain: string
): Promise<DistrictBranding | null> {
  const now = Date.now();
  const cached = subdomainCache.get(subdomain);

  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.branding;
  }

  // White-listed columns only — never SELECT *. New columns added to the
  // districts table later (e.g. contact_email) must not auto-leak into the
  // request-side branding header.
  const admin = createAdminClient();
  const { data } = await admin
    .from("districts")
    .select("id, name, logo_url, primary_color, secondary_color")
    .eq("subdomain", subdomain)
    .eq("active", true)
    .single();

  const branding: DistrictBranding | null = data
    ? {
        id: data.id,
        name: data.name,
        logoUrl: data.logo_url,
        primaryColor: data.primary_color,
        secondaryColor: data.secondary_color,
      }
    : null;
  subdomainCache.set(subdomain, { branding, cachedAt: now });
  return branding;
}

/* ─── Subdomain extraction ────────────────────────────────────────────── */

function extractSubdomain(request: NextRequest): string | null {
  const baseDomain = process.env.NEXT_PUBLIC_JSWP_BASE_DOMAIN;
  const host = request.headers.get("host") ?? "";

  // localhost is the dev convenience that auto-resolves to the demo district.
  // 127.0.0.1 deliberately does NOT — use it locally to exercise the
  // apex/no-district fallback path (default branding, no x-jswp-* headers).
  const isDev = host.startsWith("localhost");
  const isPreview = host.endsWith(".vercel.app");

  if (isDev || isPreview) {
    return "demo";
  }

  if (baseDomain && host.endsWith(baseDomain)) {
    const prefix = host.slice(0, -baseDomain.length).replace(/\.$/, "");
    return prefix === "" || prefix === "www" ? null : prefix;
  }

  // Unknown host — treat as apex
  return null;
}

/* ─── Middleware ───────────────────────────────────────────────────────── */

export async function middleware(request: NextRequest) {
  // 1. Auth session refresh (standard Supabase + Next.js 15 pattern)
  const { supabase, response } = createMiddlewareClient(request);
  await supabase.auth.getUser();

  // 2. Subdomain → district resolution
  const subdomain = extractSubdomain(request);

  if (subdomain === null) {
    // Apex domain — pass through without district headers.
    // app/layout.tsx will fall back to default branding.
    return response;
  }

  const branding = await resolveSubdomain(subdomain);

  if (branding === null) {
    // Unknown subdomain — redirect to apex domain
    const baseDomain = process.env.NEXT_PUBLIC_JSWP_BASE_DOMAIN;
    if (baseDomain) {
      const protocol = request.nextUrl.protocol;
      return NextResponse.redirect(`${protocol}//${baseDomain}`);
    }
    // No base domain configured (dev) — pass through
    return response;
  }

  // Set request-side branding headers for downstream RSCs.
  // These are forwarded via NextResponse.next({ request: { headers } }) —
  // they reach the SSR pass but never the browser response.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-jswp-district-id", branding.id);
  requestHeaders.set("x-jswp-district-name", branding.name);
  if (branding.primaryColor) {
    requestHeaders.set("x-jswp-district-primary", branding.primaryColor);
  }
  if (branding.secondaryColor) {
    requestHeaders.set("x-jswp-district-secondary", branding.secondaryColor);
  }
  if (branding.logoUrl) {
    requestHeaders.set("x-jswp-district-logo", branding.logoUrl);
  }

  // Carry forward any refreshed-session cookies that @supabase/ssr wrote
  // onto `response` during getUser() — otherwise this branch silently
  // drops them and the user gets logged out when the access token rotates.
  const brandedResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.cookies.getAll().forEach((cookie) => {
    brandedResponse.cookies.set(cookie);
  });
  return brandedResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth/.*|.*\\..*).*)",
  ],
};
