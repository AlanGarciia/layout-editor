import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // genera un build autocontenido, ideal para Docker (imagen mucho mas ligera)
  output: "standalone",
  turbopack: {
    root: path.join(__dirname),
  },
  devIndicators: false,
};

export default withNextIntl(nextConfig);