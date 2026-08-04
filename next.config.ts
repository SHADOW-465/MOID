import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tree-shake large packages that ship multi-entry barrels (faster cold parse).
  experimental: {
    optimizePackageImports: ["geist", "zod", "ai"],
  },
  // Compress responses when not behind a CDN that already does gzip.
  compress: true,
  // Don't ship source maps to the browser in production.
  productionBrowserSourceMaps: false,
  // Prefer modularize imports for icon-less design system.
  poweredByHeader: false,
};

export default nextConfig;
