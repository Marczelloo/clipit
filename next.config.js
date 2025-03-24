/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Increase timeouts and limits for large file handling
  serverRuntimeConfig: {
    maxBodySize: "500mb",
  },

  // The API configuration needs to be in middleware or route handlers directly
  // For file uploads, use middleware or route configuration
  experimental: {
    // Use proper format for experimental features
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
  
  // Moved from experimental to top level per Next.js recommendation
  serverExternalPackages: ['ffmpeg-static'],

  // Configure image domains if needed
  images: {
    domains: [],
  },
};

export default config;