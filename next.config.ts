import path from "path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// OD-7: bilingual AR/EN via next-intl. Points the plugin at the per-request
// config (locale negotiation + message loading).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  typedRoutes: true,
  outputFileTracingRoot: path.join(__dirname),
  // REG-28: opt into `app/global-not-found.tsx` so unknown routes + notFound()
  // render a localized full-document 404. Required because the app's <html> lives
  // in the dynamic `[locale]/layout.tsx`, which Next 15.5 can't re-apply to a
  // bubbled notFound() (it falls back to the bare `__next_error__` shell).
  experimental: {
    globalNotFound: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
