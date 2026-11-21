import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  // Minimal production bundle for the Docker runner (see Dockerfile)
  output: "standalone",
  experimental: {
    // AI-187: these packages are barrel files that re-export dozens of
    // primitives. Without this, importing one icon or one Radix primitive
    // pulls the whole barrel into every route's first-load bundle.
    optimizePackageImports: ["radix-ui", "@animate-ui/react", "lucide-react"],
  },
};

export default withBundleAnalyzer(nextConfig);
