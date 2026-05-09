const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
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
  
  // Disable ESLint during build to avoid configuration issues
  eslint: {
    ignoreDuringBuilds: true,
  },
  
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

    // Support for various image file extensions
    dangerouslyAllowSVG: true,
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

  // Headers for performance
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
