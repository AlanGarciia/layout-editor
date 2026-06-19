import Konva from "konva";
import type { LayerData } from "./types";

/*
 * KonvaRenderer: unico sitio que toca Konva.
 * - Crea el Stage y la capa de dibujo.
 * - Mantiene un mapa id -> nodo Konva.
 * - Los nodos son `draggable`: Konva mueve el nodo solo, sin React.
 *   Al soltar, avisa al engine (onNodeDragEnd) para guardar el dato.
 */
export class KonvaRenderer {
  private stage: Konva.Stage;
  private layer: Konva.Layer;
  private transformer: Konva.Transformer;
  private nodes = new Map<string, Konva.Node>();

  // callbacks que el engine asigna
  onNodeDragEnd: (id: string, x: number, y: number) => void = () => {};
  onSelect: (id: string | null) => void = () => {};

  constructor(container: HTMLDivElement, width: number, height: number) {
    this.stage = new Konva.Stage({ container, width, height });
    this.layer = new Konva.Layer();
    this.stage.add(this.layer);

    this.transformer = new Konva.Transformer({ rotateEnabled: true });
    this.layer.add(this.transformer);

    // click en vacio = deseleccionar
    this.stage.on("click tap", (e) => {
      if (e.target === this.stage) this.onSelect(null);
    });
  }

  addNode(data: LayerData) {
    // ejemplo con imagen; el texto seria un Konva.Text analogo
    const img = new window.Image();
    img.src = data.src!;
    img.onload = () => {
      const node = new Konva.Image({
        id: data.id,
        image: img,
        x: data.x,
        y: data.y,
        rotation: data.rotation,
        scaleX: data.scaleX,
        scaleY: data.scaleY,
        draggable: true,
        // claves de rendimiento:
        perfectDrawEnabled: false,
        shadowForStrokeEnabled: false,
      });

      // al soltar el drag, avisamos al engine (NO en cada frame)
      node.on("dragend", () => {
        this.onNodeDragEnd(data.id, node.x(), node.y());
      });
      node.on("click tap", () => this.onSelect(data.id));

      this.nodes.set(data.id, node);
      this.layer.add(node);
      this.layer.batchDraw();
    };
  }

  updateNode(id: string, attrs: Partial<{ x: number; y: number; rotation: number; scaleX: number; scaleY: number }>) {
    const node = this.nodes.get(id);
    if (!node) return;
    node.setAttrs(attrs);
    this.layer.batchDraw();
  }

  removeNode(id: string) {
    const node = this.nodes.get(id);
    if (!node) return;
    node.destroy();
    this.nodes.delete(id);
    this.layer.batchDraw();
  }

  setSelection(id: string | null) {
    if (!id) {
      this.transformer.nodes([]);
    } else {
      const node = this.nodes.get(id);
      this.transformer.nodes(node ? [node] : []);
    }
    this.layer.batchDraw();
  }

  setZoom(scale: number) {
    // zoom puro Konva, sin React
    this.stage.scale({ x: scale, y: scale });
    this.stage.batchDraw();
  }

  clear() {
    this.nodes.forEach((n) => n.destroy());
    this.nodes.clear();
    this.transformer.nodes([]);
    this.layer.batchDraw();
  }

  destroy() {
    this.stage.destroy();
  }
}