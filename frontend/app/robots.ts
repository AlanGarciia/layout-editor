import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/*
 * robots.txt: permite rastrear todo el sitio publico y bloquea las rutas
 * de la herramienta interactiva (editor/optimizer no aportan a SEO y
 * dependen del backend). El sitemap se anuncia para que Google lo encuentre.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // opcional: no indexar las apps interactivas (no son contenido SEO)
      disallow: ["/en/app/", "/es/app/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}