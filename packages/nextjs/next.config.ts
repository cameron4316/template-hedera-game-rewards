import fs from "fs";
import type { NextConfig } from "next";
import path from "path";

// The repo-root .env is the single source of configuration; values already in the environment win.
const rootEnv = path.join(__dirname, "../../.env");
if (fs.existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  reactStrictMode: true,
  serverExternalPackages: ["@hiero-ledger/sdk"],
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  eslint: {
    ignoreDuringBuilds: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  webpack: (config, { dev }) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    if (dev) {
      config.watchOptions = {
        followSymlinks: true,
      };
      config.snapshot = { ...(config.snapshot as object), managedPaths: [] };
    }
    return config;
  },
};

module.exports = nextConfig;
