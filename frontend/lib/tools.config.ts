// Fuente de verdad de las herramientas.
export type OutputKind = "download" | "layers" | "image";

export interface ToolConfig {
  slug: string;
  plugin: string;
  title: string;
  description: string;
  intro: string;
  accept: string;
  outputKind: OutputKind;
  premium?: boolean;
}

export const TOOLS: ToolConfig[] = [
  {
    slug: "image-to-layers",
    plugin: "image_to_layers",
    title: "Separar imagen en capas por color online",
    description:
      "Convierte una imagen plana (PNG o JPG) en capas editables por color. Gratis y sin registro.",
    intro:
      "Sube una imagen y la separamos automaticamente en capas por color, listas para editar o exportar.",
    accept: ".png,.jpg,.jpeg,.webp,image/*",
    outputKind: "layers",
  },
  {
    slug: "png-to-psd",
    plugin: "psd_export",
    title: "Convertir PNG a PSD con capas online",
    description:
      "Sube un PNG y descargalo como archivo PSD de Photoshop con capas. Gratis, sin marca de agua.",
    intro:
      "Convierte tu PNG en un PSD editable manteniendo las capas. Sin instalar nada.",
    accept: ".png,image/png",
    outputKind: "download",
  },
];

export const getTool = (slug: string): ToolConfig | undefined =>
  TOOLS.find((t) => t.slug === slug);

export const allToolSlugs = (): string[] => TOOLS.map((t) => t.slug);