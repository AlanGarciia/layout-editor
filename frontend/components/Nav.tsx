"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/*
 * Barra de navegacion global. Va en el layout, asi aparece en todas las paginas.
 * Resalta el enlace activo segun la ruta actual.
 */

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/app/editor", label: "Editor" },
  { href: "/app/optimizer", label: "Optimizer" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="lf-nav">
      <Link href="/" className="lf-nav-brand">
        LayerForge
      </Link>
      <div className="lf-nav-links">
        {LINKS.map((l) => {
          // activo si la ruta coincide exacta, o empieza por el href (para subrutas)
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
    </nav>
  );
}