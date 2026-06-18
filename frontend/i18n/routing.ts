import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // idiomas soportados
  locales: ["en", "es"],
  // idioma por defecto
  defaultLocale: "en",
  // ambos idiomas con prefijo: /en y /es
  localePrefix: "always",
});