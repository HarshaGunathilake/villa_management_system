import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The MySQL driver runs as-is on the server instead of being bundled.
  serverExternalPackages: ["mysql2"],
  // Lets `npm run dev` be opened through an ngrok tunnel (used for testing Dodo payments). Development only.
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app"],
};

export default nextConfig;
