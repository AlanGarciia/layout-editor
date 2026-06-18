import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { TOOLS, getTool } from "@/lib/tools.config";
import ToolRunner from "@/components/landing/ToolRunner";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export function generateStaticParams() {
  return TOOLS.map((t) => ({ tool: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tool: string; locale: string }>;
}): Promise<Metadata> {
  const { tool: slug, locale } = await params;
  const tool = getTool(slug);
  if (!tool) return {};
  const tt = await getTranslations({ locale, namespace: "tools" });
  const title = tt(`${slug}.title`);
  const description = tt(`${slug}.description`);
  const url = `${SITE_URL}/${locale}/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/${slug}`,
      languages: {
        en: `/en/${slug}`,
        es: `/es/${slug}`,
        "x-default": `/en/${slug}`,
      },
    },
    openGraph: {
      type: "website",
      siteName: "LayersWork",
      title,
      description,
      url,
      locale: locale === "es" ? "es_ES" : "en_US",
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.png"],
    },
  };
}

export default async function ToolLanding({
  params,
}: {
  params: Promise<{ tool: string; locale: string }>;
}) {
  const { tool: slug, locale } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  const tt = await getTranslations({ locale, namespace: "tools" });
  const tl = await getTranslations({ locale, namespace: "landing" });

  return (
    <div className="lf-home">
      <main className="tool-page">
        <Link href="/" className="tool-back">{tl("back")}</Link>

        <h1 className="tool-title">{tt(`${slug}.title`)}</h1>
        <p className="tool-intro">{tt(`${slug}.intro`)}</p>

        <ToolRunner tool={tool} />

        <section className="tool-seo">
          <h2>{tl("howItWorks")}</h2>
          <p>{tt(`${slug}.description`)}</p>
          <p>{tl("noSignup")}</p>
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