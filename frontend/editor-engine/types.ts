export interface LayerData {
  id: string;
  name: string;
  type: "image" | "text";
  src?: string;          // dataURL de la imagen
  text?: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  visible: boolean;
}

// eventos que el engine emite hacia React
export interface EngineEvents {
  change: null;             // algo cambio (panel debe refrescar)
  selection: string | null; // cambio la seleccion
}