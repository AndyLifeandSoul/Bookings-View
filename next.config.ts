import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Railway's build cache mount doesn't survive between builds the way
    // Turbopack's persistent filesystem cache expects, and it corrupts
    // ("Invalid block type" / "Batch data restore failed" panics, exit
    // code 134) rather than just missing. Off is slower per-build but
    // deterministic, which matters far more on a deploy path.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
