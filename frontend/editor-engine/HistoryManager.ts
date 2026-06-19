import type { LayerData } from "./types";

/*
 * HistoryManager: pila de undo/redo para el engine.
 * Guarda snapshots del estado de capas (array completo).
 * - push: registra un nuevo estado (e invalida el redo).
 * - undo / redo: navegan por la historia.
 * Limite configurable para no crecer sin fin.
 */
export class HistoryManager {
  private past: LayerData[][] = [];
  private future: LayerData[][] = [];
  private limit: number;

  constructor(limit = 50) {
    this.limit = limit;
  }

  // registra un estado nuevo en la historia
  push(state: LayerData[]) {
    this.past.push(state);
    if (this.past.length > this.limit) {
      this.past.shift(); // descarta el mas antiguo
    }
    this.future = []; // cualquier cambio nuevo invalida el redo
  }

  // devuelve el estado anterior (o null si no hay)
  undo(): LayerData[] | null {
    if (this.past.length < 2) return null; // necesita al menos un estado previo
    const current = this.past.pop()!;
    this.future.unshift(current);
    return this.past[this.past.length - 1] ?? null;
  }

  // devuelve el estado siguiente (o null si no hay)
  redo(): LayerData[] | null {
    if (this.future.length === 0) return null;
    const next = this.future.shift()!;
    this.past.push(next);
    return next;
  }

  canUndo(): boolean {
    return this.past.length >= 2;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  clear() {
    this.past = [];
    this.future = [];
  }
}