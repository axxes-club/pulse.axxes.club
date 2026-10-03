import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  async headers() {
    return [
      {source:"/embed/:path*",headers:[{key:"Content-Security-Policy",value:"frame-ancestors https://members.axxes.club https://members.axxes.app https://axxes.app"}]},
      {source:"/api/auth/bridge/:path*",headers:[{key:"Referrer-Policy",value:"no-referrer"},{key:"Cache-Control",value:"no-store"}]},
      {source:"/sdk/:path*",headers:[{key:"Access-Control-Allow-Origin",value:"*"},{key:"Cache-Control",value:"public, max-age=3600"}]},
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
  ...(process.env.PULSE_LOW_DISK === "1" ? { webpack(config: any) { config.cache = false; return config; } } : {}),
};
export default nextConfig;
