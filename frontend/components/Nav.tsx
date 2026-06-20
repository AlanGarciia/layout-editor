"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { toolsByCategory } from "@/lib/tools.config";

/*
 * Nav global con traducciones, selector de idioma y menu desplegable
 * de "Conversores" (se llena solo desde tools.config -> category "converter").
 */

export default function Nav() {
  const t = useTranslations("nav");
  const tt = useTranslations("tools");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  // estado del desplegable de conversores
  const [openConv, setOpenConv] = useState(false);
  const convRef = useRef<HTMLDivElement>(null);

  // conversores desde la config (categoria "converter")
  const converters = toolsByCategory("converter");

  const links = [
    { href: "/", label: t("home") },
    { href: "/app/editor", label: t("editor") },
    { href: "/app/optimizer", label: t("optimizer") },
    { href: "/remove-background", label: t("removeBg") },
  ];

  // cerrar el desplegable al hacer clic fuera
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (convRef.current && !convRef.current.contains(e.target as Node)) {
        setOpenConv(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // cambia de idioma manteniendo la misma ruta
  const switchLocale = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  const convActive = converters.some((c) => pathname.startsWith(`/${c.slug}`));

  return (
    <nav className="lf-nav">
      <Link href="/" className="lf-nav-brand">
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

        {/* Desplegable de conversores */}
        {converters.length > 0 && (
          <div className="lf-nav-dropdown" ref={convRef}>
            <button
              className={`lf-nav-link lf-nav-dropdown-btn ${convActive ? "lf-nav-active" : ""}`}
              onClick={() => setOpenConv((v) => !v)}
              aria-expanded={openConv}
            >
              {t("converters")}
              <span className={`lf-nav-caret ${openConv ? "lf-nav-caret-up" : ""}`}>▾</span>
            </button>
            {openConv && (
              <div className="lf-nav-menu">
                {converters.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/${c.slug}`}
                    className="lf-nav-menu-item"
                    onClick={() => setOpenConv(false)}
                  >
                    {tt(`${c.slug}.title`)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
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