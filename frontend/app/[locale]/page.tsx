import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { toolsByCategory } from "@/lib/tools.config";

export default function Home() {
  const t = useTranslations("home");
  const tt = useTranslations("tools");

  // herramientas agrupadas por categoria
  const editorTools = toolsByCategory("editor");
  const converterTools = toolsByCategory("converter");

  return (
    <div className="lf-home">
      <section className="lf-hero">
        <span className="lf-badge">{t("badge")}</span>
        <h1 className="lf-hero-title">{t("title")}</h1>
        <p className="lf-hero-sub">{t("subtitle")}</p>
        <div className="lf-hero-cta">
          <Link href="/app/editor" className="lf-btn lf-btn-primary">
            {t("openEditor")}
          </Link>
          <Link href="/app/optimizer" className="lf-btn lf-btn-ghost">
            {t("optimizeImages")}
          </Link>
        </div>
      </section>

      {/* Herramientas principales (categoria editor) */}
      <section className="lf-tools">
        <h2 className="lf-section-title">{t("toolsTitle")}</h2>
        <p className="lf-section-sub">{t("toolsSubtitle")}</p>
        <div className="lf-grid">
          {editorTools.map((tool) => (
            <Link key={tool.slug} href={`/${tool.slug}`} className="lf-card">
              <h3>{tt(`${tool.slug}.title`)}</h3>
              <p>{tt(`${tool.slug}.description`)}</p>
              <span className="lf-card-link">{t("tryIt")}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Seccion de conversores (categoria converter) */}
      {converterTools.length > 0 && (
        <section className="lf-tools">
          <h2 className="lf-section-title">{t("convertersTitle")}</h2>
          <p className="lf-section-sub">{t("convertersSubtitle")}</p>
          <div className="lf-grid">
            {converterTools.map((tool) => (
              <Link key={tool.slug} href={`/${tool.slug}`} className="lf-card">
                <h3>{tt(`${tool.slug}.title`)}</h3>
                <p>{tt(`${tool.slug}.description`)}</p>
                <span className="lf-card-link">{t("tryIt")}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <footer className="lf-footer">
        <span>LayersWork</span>
        <nav>
          <Link href="/app/editor">Editor</Link>
          <Link href="/app/optimizer">Optimizer</Link>
        </nav>
      </footer>
    </div>
  );
}