/** @type {import('next').NextConfig} */
const nextConfig = {
  // Performance Optimizations
  compress: true,
  poweredByHeader: false,
  
  // Experimental optimizations for better performance
  experimental: {
    // Enable optimized package imports
    optimizePackageImports: ['lucide-react', '@supabase/supabase-js'],
  },

  // Caching optimizations
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 60 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 5,
  },

  // Bundle optimization handled by Next.js 14+ automatically
  
  // Image optimization
  images: {
    // Enable support for multiple image formats
    formats: ["image/webp", "image/avif"],
    // Optimize image loading
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    
    // Allow external image domains (add your Supabase storage domain)
    domains: [
      "localhost",
      "zyivphqxqmbslxcrzbnh.supabase.co", // Your Supabase project domain
    ],
    
    // Modern remotePatterns configuration for better security
    remotePatterns: [
      {
        protocol: "https",
        hostname: "zyivphqxqmbslxcrzbnh.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "3000",
        pathname: "/**",
      },
    ],
    
    // Support for various image file extensions
    dangerouslyAllowSVG: true,
    contentSecurityPolicy:
      "default-src 'self' https://zyivphqxqmbslxcrzbnh.supabase.co; script-src 'none'; sandbox;",
  },

  // Optimized webpack configuration
  webpack: (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Separate Supabase into its own chunk
            supabase: {
              name: 'supabase',
              chunks: 'all',
              test: /[\\/]node_modules[\\/]@supabase[\\/]/,
              priority: 30,
            },
            // React and core libraries
            react: {
              name: 'react',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              priority: 20,
            },
            // Other vendor libraries
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /[\\/]node_modules[\\/]/,
              priority: 10,
            },
            // Common code across the app
            common: {
              name: 'common',
              chunks: 'all',
              minChunks: 2,
              priority: 5,
            },
          },
        },
      };
    }

    // Handle SVG files with optimization
    config.module.rules.push({
      test: /\.svg$/,
      use: [
        {
          loader: "@svgr/webpack",
          options: {
            svgoConfig: {
              plugins: [
                {
                  name: 'preset-default',
                  params: {
                    overrides: {
                      removeViewBox: false,
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    });

    // Optimize image handling
    config.module.rules.push({
      test: /\.(png|jpe?g|gif|webp|avif)$/i,
      use: {
        loader: "file-loader",
        options: {
          publicPath: "/_next/static/images/",
          outputPath: "static/images/",
          name: "[name].[hash].[ext]",
        },
      },
    });

    // Add bundle analyzer in development
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
      source: '/(.*)',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
      ],
    },
    {
      source: '/dashboard/(.*)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'no-store, no-cache, must-revalidate',
        },
      ],
    },
  ],
};

module.exports = nextConfig;
