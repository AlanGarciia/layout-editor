import type { Metadata } from "next";
import "./globals.css";

/*
 * Layout raiz. Con i18n, el <html> real y los providers van en
 * app/[locale]/layout.tsx (necesita saber el idioma). Aqui solo pasamos
 * children; Next exige un layout raiz que devuelva html/body, pero next-intl
 * recomienda que el lang correcto se ponga en el layout de [locale].
 */

export const metadata: Metadata = {
  title: {
    default: "LayerForge",
    template: "%s | LayerForge",
  },
  description:
    "Edit, separate and optimize your designs online. Free, no signup.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}