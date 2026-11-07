import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CORS for the Chrome extension calling the API from amazon.co.uk (demo-only, single user).
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,PUT,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
          { key: "Access-Control-Allow-Private-Network", value: "true" },
        ],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
