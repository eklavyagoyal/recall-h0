import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg uses dynamic requires; keep it as a real Node module instead of bundling it.
  serverExternalPackages: ["pg"],
  // Ship the RDS CA bundle alongside any function that opens an Aurora connection
  // (the home RSC runs the trace server-side; the API routes hit the DB too).
  outputFileTracingIncludes: {
    "/": ["./certs/**"],
    "/api/**": ["./certs/**"],
  },
};

export default nextConfig;
