// Fuente de verdad de las herramientas.
// Los TEXTOS (title, description, intro) ya no van aqui: viven en los JSON de
// traduccion bajo la clave tools.{slug}.*. Aqui solo queda la definicion tecnica.

export type OutputKind = "download" | "layers" | "image";

// categoria para agrupar herramientas en el nav y la home
export type ToolCategory = "editor" | "converter" | "optimizer";

export interface ToolConfig {
  slug: string;          // URL de la landing y clave de traduccion: tools.{slug}
  plugin: string;        // plugin backend que ejecuta
  accept: string;        // atributo accept del input de archivo
  outputKind: OutputKind;
  category: ToolCategory; // para agrupar (conversores, etc.)
  premium?: boolean;
}

export const TOOLS: ToolConfig[] = [
  {
    slug: "image-to-layers",
    plugin: "image_to_layers",
    accept: ".png,.jpg,.jpeg,.webp,image/*",
    outputKind: "layers",
    category: "editor",
  },
  {
    slug: "png-to-psd",
    plugin: "psd_export",
    accept: ".png,image/png",
    outputKind: "download",
    category: "converter",
  },
  {
    slug: "remove-background",
    plugin: "remove_background",
    accept: ".png,.jpg,.jpeg,.webp,image/*",
    outputKind: "download",
    category: "editor",
  },
  {
    slug: "heic-to-jpg",
    plugin: "heic_to_jpg",
    accept: ".heic,.heif,image/heic,image/heif",
    outputKind: "download",
    category: "converter",
  },
];

export const getTool = (slug: string): ToolConfig | undefined =>
  TOOLS.find((t) => t.slug === slug);

export const allToolSlugs = (): string[] => TOOLS.map((t) => t.slug);

// herramientas de una categoria concreta (para nav y home)
export const toolsByCategory = (cat: ToolCategory): ToolConfig[] =>
  TOOLS.filter((t) => t.category === cat);

// la clave de traduccion de una tool a partir de su slug (guiones -> nada)
// p.ej. "image-to-layers" -> usamos el slug tal cual como clave anidada
export const toolKey = (slug: string): string => slug;