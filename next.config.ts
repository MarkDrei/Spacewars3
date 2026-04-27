import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
};

export default withNextIntl(
  withPWA({
    dest: "public",
    register: true,
    disable: process.env.NODE_ENV === "development",
    workboxOptions: {
      skipWaiting: true,
    },
  })(nextConfig)
);
