/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Enable support for multiple image formats
    formats: ["image/webp", "image/avif"],
    // Allow external image domains (add your Supabase storage domain)
    domains: [
      "localhost",
      // Add your Supabase project domain here
      // Example: 'your-project.supabase.co'
    ],
    // Support for various image file extensions
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Enable experimental features if needed
  experimental: {
    // Add any experimental features here
  },
  // Webpack configuration for handling additional file types
  webpack: (config) => {
    // Handle SVG files
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });

    // Handle various image formats
    config.module.rules.push({
      test: /\.(png|jpe?g|gif|webp|avif)$/i,
      use: {
        loader: "file-loader",
        options: {
          publicPath: "/_next/static/images/",
          outputPath: "static/images/",
        },
      },
    });

    return config;
  },
};

module.exports = nextConfig;
