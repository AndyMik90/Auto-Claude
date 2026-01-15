import type { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      // CONVEX_SITE_URL is set by npx convex dev in .env.local
      domain: process.env.CONVEX_SITE_URL!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
