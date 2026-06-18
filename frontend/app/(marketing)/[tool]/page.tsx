import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { TOOLS, getTool } from "@/lib/tools.config";
import ToolRunner from "@/components/landing/ToolRunner";

/*
 * Plantilla unica de landing por herramienta (Server Component -> SEO).
 * La URL /[tool] (p. ej. /png-to-psd) busca la tool en la config y renderiza
 * su landing. generateStaticParams crea una pagina estatica por cada tool.
 */

// Una pagina estatica por cada slug de la config
export function generateStaticParams() {
  return TOOLS.map((t) => ({ tool: t.slug }));
}

// SEO: titulo y descripcion por pagina, en HTML servido
export async function generateMetadata({
  params,
}: {
  params: Promise<{ tool: string }>;
}): Promise<Metadata> {
  const { tool: slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};
  return {
    title: tool.title,
    description: tool.description,
    alternates: { canonical: `/${tool.slug}` },
  };
}

export default async function ToolLanding({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const { tool: slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  return (
    <div className="lf-home">
      <main className="tool-page">
        <Link href="/" className="tool-back">&lt;- Inicio</Link>

        <h1 className="tool-title">{tool.title}</h1>
        <p className="tool-intro">{tool.intro}</p>

        {/* Demo interactiva sin registro */}
        <ToolRunner tool={tool} />

        {/* Bloque de texto para SEO (contenido indexable) */}
        <section className="tool-seo">
          <h2>Como funciona</h2>
          <p>{tool.description}</p>
          <p>
            Todo el proceso ocurre al instante y sin necesidad de crear una
            cuenta. Sube tu archivo, procesa y descarga el resultado.
          </p>
        </section>
      </main>

      <style>{`
        .tool-page { max-width: 760px; margin: 0 auto; padding: 56px 24px 80px; }
        .tool-back { color: var(--muted); text-decoration: none; font-size: 14px; }
        .tool-back:hover { color: var(--txt); }
        .tool-title { font-size: 40px; font-weight: 700; letter-spacing: -0.02em;
          margin: 24px 0 12px; line-height: 1.1; }
        .tool-intro { color: var(--muted); font-size: 18px; line-height: 1.5; margin: 0; }
        .tool-seo { margin-top: 56px; border-top: 1px solid var(--line); padding-top: 32px; }
        .tool-seo h2 { font-size: 22px; font-weight: 600; margin: 0 0 12px; }
        .tool-seo p { color: var(--muted); line-height: 1.6; margin: 0 0 12px; }
      `}</style>
    </div>
  );
}