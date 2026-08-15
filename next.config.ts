import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root explicitly - there's a stray package-lock.json one
  // level up (outside this project), which made Turbopack's auto-detection
  // pick that outer folder as the root and fail to resolve dependencies that
  // only exist in this project's own node_modules.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
