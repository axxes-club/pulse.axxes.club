import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  async headers() {
    return [
      {
        source: "/vendor/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/pulse.v1.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
    ];
  },
  webpack(config) {
    if (process.env.PULSE_LOW_DISK === "1") config.cache = false;
    return config;
  },
};
export default nextConfig;
