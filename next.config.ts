import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-route badge sits bottom-left, on top of the roster and the court
  // cards. It only shows in development, but this app gets demoed off `next
  // dev` on a phone, where it covers real content.
  devIndicators: false,
};

export default nextConfig;
