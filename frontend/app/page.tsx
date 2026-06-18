import Link from "next/link";
import { TOOLS } from "@/lib/tools.config";

/*
 * Home / Landing principal (Server Component, renderizado estatico -> SEO).
 * - Hero con titulo y botones al editor y al optimizer.
 * - Grid de herramientas generado desde tools.config.ts.
 * - Sin "use client": es HTML servido, ideal para indexar.
 */

export const metadata = {
  title: "LayerForge — Edita, separa y optimiza tus disenos online",
  description:
    "Convierte imagenes en capas, exporta a PSD o SVG y optimiza tus archivos para web, redes e impresion. Gratis y sin registro.",
};

export default function Home() {
  return (
    <div className="lf-home">
      {/* HERO */}
      <section className="lf-hero">
        <span className="lf-badge">Editor de capas online</span>
        <h1 className="lf-hero-title">
          Edita, separa y optimiza<br />tus disenos en el navegador
        </h1>
        <p className="lf-hero-sub">
          Sube una imagen o un SVG, sepáralo en capas editables, anade texto y
          exporta a PSD o SVG. Sin instalar nada, sin marcas de agua.
        </p>
        <div className="lf-hero-cta">
          <Link href="/app/editor" className="lf-btn lf-btn-primary">
            Abrir el editor
          </Link>
          <Link href="/app/optimizer" className="lf-btn lf-btn-ghost">
            Optimizar imagenes
          </Link>
        </div>
      </section>

      {/* HERRAMIENTAS (desde la config) */}
      <section className="lf-tools">
        <h2 className="lf-section-title">Herramientas</h2>
        <p className="lf-section-sub">
          Cada herramienta funciona sola, sin registro. Pruebala y descarga el resultado.
        </p>
        <div className="lf-grid">
          {TOOLS.map((tool) => (
            <Link key={tool.slug} href={`/${tool.slug}`} className="lf-card">
              <h3>{tool.title}</h3>
              <p>{tool.description}</p>
              <span className="lf-card-link">Probar -&gt;</span>
            </Link>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lf-footer">
        <span>LayerForge</span>
        <nav>
          <Link href="/app/editor">Editor</Link>
          <Link href="/app/optimizer">Optimizer</Link>
        </nav>
      </footer>
    </div>
  );
}