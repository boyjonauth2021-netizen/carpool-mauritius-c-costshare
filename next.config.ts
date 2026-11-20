import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/carpool-mauritius-c-costshare",
  trailingSlash: true,
  images: { unoptimized: true },
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
