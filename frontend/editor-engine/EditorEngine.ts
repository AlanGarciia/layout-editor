import { KonvaRenderer } from "./KonvaRenderer";
import { HistoryManager } from "./HistoryManager";
import { EventEmitter } from "./events";
import type { LayerData, EngineEvents } from "./types";

/*
 * EditorEngine: el "cerebro" del editor. TS puro, sin React.
 * - Es la unica fuente de verdad del estado del canvas.
 * - React llama a sus metodos; nunca toca el canvas directamente.
 * - Avisa a React de cambios "importantes" (no de cada frame de drag)
 *   mediante el EventEmitter.
 */
export class EditorEngine {
  private renderer: KonvaRenderer;
  private history: HistoryManager;
  private events = new EventEmitter<EngineEvents>();

  // fuente de verdad: datos de las capas (NO en React)
  private layers = new Map<string, LayerData>();
  private selectedId: string | null = null;

  constructor(container: HTMLDivElement, width: number, height: number) {
    this.renderer = new KonvaRenderer(container, width, height);
    this.history = new HistoryManager();

    // cuando el renderer detecta un drag, actualiza SOLO el dato,
    // sin pasar por React (el nodo Konva ya se movio solo).
    this.renderer.onNodeDragEnd = (id, x, y) => {
      const layer = this.layers.get(id);
      if (!layer) return;
      layer.x = x;
      layer.y = y;
      this.commitHistory();           // historial: esto SI es un cambio "final"
      this.events.emit("change", null); // avisa a React (panel, etc.)
    };

    this.renderer.onSelect = (id) => this.selectLayer(id);
  }

  // ---- API publica (lo que React llama) ----

  addLayer(data: LayerData) {
    this.layers.set(data.id, data);
    this.renderer.addNode(data);
    this.commitHistory();
    this.events.emit("change", null);
  }

  // Movimiento programatico (ej: desde un input numerico).
  // El drag interactivo NO pasa por aqui: lo maneja Konva directo.
  moveLayer(id: string, x: number, y: number) {
    const layer = this.layers.get(id);
    if (!layer) return;
    layer.x = x;
    layer.y = y;
    this.renderer.updateNode(id, { x, y });
    this.events.emit("change", null);
  }

  setZoom(value: number) {
    this.renderer.setZoom(value);
    // el zoom NO toca React; es puro Konva
  }

  selectLayer(id: string | null) {
    this.selectedId = id;
    this.renderer.setSelection(id);
    this.events.emit("selection", id); // React actualiza el panel
  }

  removeLayer(id: string) {
    this.layers.delete(id);
    this.renderer.removeNode(id);
    if (this.selectedId === id) this.selectLayer(null);
    this.commitHistory();
    this.events.emit("change", null);
  }

  // ---- Lectura para React (snapshots, no estado vivo) ----

  // React llama esto para pintar el panel de capas.
  getLayersSnapshot(): LayerData[] {
    return Array.from(this.layers.values());
  }

  getSelectedId() {
    return this.selectedId;
  }

  // ---- Historial ----

  private commitHistory() {
    this.history.push(this.serializeState());
  }

  undo() {
    const prev = this.history.undo();
    if (prev) this.restoreState(prev);
  }

  redo() {
    const next = this.history.redo();
    if (next) this.restoreState(next);
  }

  private serializeState(): LayerData[] {
    return structuredClone(Array.from(this.layers.values()));
  }

  private restoreState(state: LayerData[]) {
    this.layers.clear();
    this.renderer.clear();
    for (const l of state) {
      this.layers.set(l.id, l);
      this.renderer.addNode(l);
    }
    this.events.emit("change", null);
  }

  // ---- Suscripcion de React ----

  on<K extends keyof EngineEvents>(event: K, cb: (data: EngineEvents[K]) => void) {
    return this.events.on(event, cb);
  }

  // ---- Export ----

  export(): LayerData[] {
    return this.serializeState();
  }

  destroy() {
    this.renderer.destroy();
  }
}