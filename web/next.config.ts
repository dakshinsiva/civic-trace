import type { NextConfig } from "next";

// Fully static export: every deploy is an immutable, versioned data release
// (see pipeline/civictrace/export.py). No server, no database at runtime.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_INCLUDE_RELATIONSHIPS: process.env.CIVICTRACE_INCLUDE_RELATIONSHIPS === "1" ? "1" : "0",
    // Public corrections & right-of-reply contact (override with the env var for forks).
    NEXT_PUBLIC_CORRECTIONS_EMAIL: process.env.NEXT_PUBLIC_CORRECTIONS_EMAIL ?? "dakshinrajsiva@gmail.com",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
