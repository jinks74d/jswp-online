const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

/**
 * Resource-loading CSP, shipped Report-Only until validated against a full
 * pass through the student writing flow. See the header comment below.
 *
 * Supabase origins are derived from env rather than hard-coded so each
 * district/preview project gets the right allowlist.
 */
function buildResourceCsp() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const storageDomain = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_DOMAIN || "";

  const supabaseHttp = [supabaseUrl, storageDomain && `https://${storageDomain}`]
    .filter(Boolean)
    .join(" ");
  const supabaseWs = supabaseUrl.replace(/^https:/, "wss:");
  const isDev = process.env.NODE_ENV !== "production";

  return [
    "default-src 'self'",
    // 'unsafe-inline' covers Next's inline bootstrap/flight scripts; a
    // nonce-based policy would need the nonce threaded through middleware.
    // 'unsafe-eval' is required by React Refresh in dev only.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    // Tailwind v4 + styled-jsx emit inline <style>.
    "style-src 'self' 'unsafe-inline'",
    // `https:` rather than just the Supabase origins: districts.logo_url is
    // a free-form URL column, not necessarily a bucket path — the demo
    // district points at an SVG hosted on lacoe.edu. Narrowing this to
    // 'self' + Supabase would break district branding. Tighten it only if
    // logo_url is ever constrained to the district-logos bucket.
    `img-src 'self' data: blob: https: ${supabaseHttp}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseHttp} ${supabaseWs}`.trim(),
    // The annotate/reference steps iframe a signed Storage URL for PDFs,
    // and pdfjs-dist renders through blob:.
    `frame-src 'self' blob: ${supabaseHttp}`.trim(),
    // pdfjs-dist instantiates its worker from a blob:.
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build output directory, overridable so a build can be run WITHOUT
  // clobbering a running dev server's cache.
  //
  // `next build` and `next dev` share .next, and building while dev is running
  // corrupts it — the app then fails at runtime in ways that read as a code
  // bug and send you debugging source that is fine. The E2E suite has to build
  // (see playwright.config.ts), so it sets NEXT_DIST_DIR=.next-e2e and stays
  // out of the way of whatever you have open on :3000.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Get Supabase domain from environment variable
  env: {
    NEXT_PUBLIC_SUPABASE_STORAGE_DOMAIN: process.env.NEXT_PUBLIC_SUPABASE_STORAGE_DOMAIN || '',
  },
  // Performance Optimizations
  compress: true,
  poweredByHeader: false,

  // Experimental optimizations for better performance
  experimental: {
    // Enable optimized package imports
    optimizePackageImports: [
      "lucide-react", 
      "@supabase/supabase-js",
      "lodash",
      "lodash-es"
    ],
  },
  
  // ESLint runs during the build. This was previously set to
  // ignoreDuringBuilds: true "to avoid configuration issues" — but the
  // configuration issue was that `next lint` silently linted nothing at all
  // (it passed legacy options ESLint 8 rejects, and still exited 0). With the
  // flat config + `eslint .` in package.json, linting is real, so the build
  // should enforce it. Do not re-disable this to get a build green.

  // Skip static export for error pages
  output: undefined,

  // Bundle optimization handled by Next.js 15+ automatically

  // Image optimization
  images: {
    // Enable support for multiple image formats
    formats: ["image/webp", "image/avif"],
    // Optimize image loading
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // Allow external image domains
    domains: [
      "localhost",
      ...(process.env.NEXT_PUBLIC_SUPABASE_STORAGE_DOMAIN ? [process.env.NEXT_PUBLIC_SUPABASE_STORAGE_DOMAIN] : []),
    ],

    // Modern remotePatterns configuration for better security
    remotePatterns: [
      ...(process.env.NEXT_PUBLIC_SUPABASE_STORAGE_DOMAIN ? [{
        protocol: "https",
        hostname: process.env.NEXT_PUBLIC_SUPABASE_STORAGE_DOMAIN,
        port: "",
        pathname: "/storage/v1/object/public/**",
      }] : []),
      {
        protocol: "http",
        hostname: "localhost",
        port: "3000",
        pathname: "/**",
      },
    ],

    // SVG never reaches the optimizer: DistrictLogo and ImageWithFallback
    // both branch SVG sources to a plain <img> on purpose, and no component
    // passes a .svg to next/image. Leaving dangerouslyAllowSVG on therefore
    // bought nothing while keeping an attacker-supplied-SVG path open on the
    // optimizer. If a future next/image call needs SVG, re-enable this AND
    // keep the sandboxing contentSecurityPolicy below.
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: process.env.NEXT_PUBLIC_SUPABASE_STORAGE_DOMAIN 
      ? `default-src 'self' https://${process.env.NEXT_PUBLIC_SUPABASE_STORAGE_DOMAIN}; script-src 'none'; sandbox;`
      : "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Webpack tweaks. Custom splitChunks removed in favor of Next.js
  // App Router defaults — the previous chunks:'all' override pulled
  // dynamic imports (unpdf) into the vendor bundle on every page.
  webpack: (config, { dev, isServer }) => {
    if (!dev) {
      config.optimization.moduleIds = "deterministic";
    }

    // Essential SVG handling (simplified)
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });

    // Essential fallbacks for development
    if (!isServer && dev) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }

    return config;
  },

  // Security + performance headers.
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        // Force HTTPS for a year, including subdomains — the product is
        // explicitly multi-subdomain ({district}.jswponline.com), so the
        // includeSubDomains directive matters here. Safe to enforce: Vercel
        // terminates TLS and redirects http→https already.
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
        {
          key: "X-Permitted-Cross-Domain-Policies",
          value: "none",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), payment=()",
        },
        // ── CSP, part 1: ENFORCED ──────────────────────────────────────
        // Only directives that cannot break rendering. These are the ones
        // that pay for themselves immediately: clickjacking (frame-ancestors
        // — the real replacement for the legacy X-Frame-Options above),
        // base-tag injection, and form exfiltration to a foreign origin.
        {
          key: "Content-Security-Policy",
          value: [
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "object-src 'none'",
          ].join("; "),
        },
        // ── CSP, part 2: REPORT-ONLY ───────────────────────────────────
        // The resource-loading half is deliberately NOT enforced yet. It has
        // to allow a lot for this app to keep working — the annotate step
        // iframes a signed Supabase Storage URL, docx-preview and pdfjs-dist
        // fetch and build blob: workers, and Next injects inline bootstrap
        // scripts (a nonce-based policy needs middleware work). Shipping it
        // enforced without exercising every step of the writing flow would
        // risk breaking students mid-assignment.
        //
        // To promote it: wire report-uri/report-to to a collector, watch a
        // full pass through each mode (decode → annotate → gather → t-chart
        // → shaping → paragraph → final draft) in a preview deploy, then move
        // this value into the enforced header above and delete this one.
        {
          key: "Content-Security-Policy-Report-Only",
          value: buildResourceCsp(),
        },
      ],
    },
    {
      source: "/dashboard/(.*)",
      headers: [
        {
          key: "Cache-Control",
          value: "no-store, no-cache, must-revalidate",
        },
      ],
    },
  ],
};

module.exports = withBundleAnalyzer(nextConfig);
