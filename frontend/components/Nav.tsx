"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/*
 * Nav global con traducciones y selector de idioma.
 * Los Link vienen de @/i18n/navigation: anaden el prefijo de idioma solos.
 */

export default function Nav() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: "/", label: t("home") },
    { href: "/app/editor", label: t("editor") },
    { href: "/app/optimizer", label: t("optimizer") },
  ];

  // cambia de idioma manteniendo la misma ruta
  const switchLocale = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <nav className="lf-nav">
      <Link href="/" className="lf-nav-brand">
        {/* Logo. Si tu logo YA incluye el texto "LayersWork", borra el <span> de abajo. */}
        <img src="/logo-symbol.png" alt="LayersWork" className="lf-nav-logo" />
        <span>{t("brand")}</span>
      </Link>
      <div className="lf-nav-links">
        {links.map((l) => {
          const active =
            l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`lf-nav-link ${active ? "lf-nav-active" : ""}`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
      <div className="lf-nav-locale">
        {routing.locales.map((loc) => (
          <button
            key={loc}
            onClick={() => switchLocale(loc)}
            className={`lf-locale-btn ${loc === locale ? "lf-locale-active" : ""}`}
          >
            {loc.toUpperCase()}
          </button>
        ))}
      </div>
    </nav>
  );
}