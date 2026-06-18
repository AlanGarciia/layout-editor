import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { TOOLS } from "@/lib/tools.config";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/*
 * Sitemap automatico. Genera una entrada por cada combinacion de
 * idioma + pagina (home, landings, editor, optimizer), con alternates
 * de idioma para que Google relacione las versiones.
 *
 * Anadir una tool a tools.config.ts la incluye aqui automaticamente.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const { locales } = routing;

  // rutas "fijas" (sin contar las landings de tools)
  const staticPaths = ["", "/app/editor", "/app/optimizer"];
  // rutas de las landings de herramientas
  const toolPaths = TOOLS.map((t) => `/${t.slug}`);

  const allPaths = [...staticPaths, ...toolPaths];

  const entries: MetadataRoute.Sitemap = [];

  for (const path of allPaths) {
    for (const locale of locales) {
      entries.push({
        url: `${SITE_URL}/${locale}${path}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: path === "" ? 1 : 0.8,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [l, `${SITE_URL}/${l}${path}`])
          ),
        },
      });
    }
  }

  return entries;
}