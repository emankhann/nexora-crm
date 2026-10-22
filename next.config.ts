import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    // Always give this a value at build time. An unset NEXT_PUBLIC_ variable is left as a
    // runtime lookup instead of being inlined, and then the demo accounts in LoginForm.tsx
    // (including their password) would stay in the production JavaScript.
    NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS: process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS ?? "false",
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
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
