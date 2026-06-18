// Fuente de verdad de las herramientas.
// Los TEXTOS (title, description, intro) ya no van aqui: viven en los JSON de
// traduccion bajo la clave tools.{slug}.*. Aqui solo queda la definicion tecnica.

export type OutputKind = "download" | "layers" | "image";

export interface ToolConfig {
  slug: string;          // URL de la landing y clave de traduccion: tools.{slug}
  plugin: string;        // plugin backend que ejecuta
  accept: string;        // atributo accept del input de archivo
  outputKind: OutputKind;
  premium?: boolean;
}

export const TOOLS: ToolConfig[] = [
  {
    slug: "image-to-layers",
    plugin: "image_to_layers",
    accept: ".png,.jpg,.jpeg,.webp,image/*",
    outputKind: "layers",
  },
  {
    slug: "png-to-psd",
    plugin: "psd_export",
    accept: ".png,image/png",
    outputKind: "download",
  },
];

export const getTool = (slug: string): ToolConfig | undefined =>
  TOOLS.find((t) => t.slug === slug);

export const allToolSlugs = (): string[] => TOOLS.map((t) => t.slug);

// la clave de traduccion de una tool a partir de su slug (guiones -> nada)
// p.ej. "image-to-layers" -> usamos el slug tal cual como clave anidada
export const toolKey = (slug: string): string => slug;