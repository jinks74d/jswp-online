/** @type {import('next').NextConfig} */
const nextConfig = {
  // Minimal config for testing
  compress: true,
  poweredByHeader: false,
  
  images: {
    domains: [
      "localhost",
      "zyivphqxqmbslxcrzbnh.supabase.co",
    ],
  },
};

module.exports = nextConfig;