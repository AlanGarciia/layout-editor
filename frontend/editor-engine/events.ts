/*
 * EventEmitter minimo y tipado. Permite que el engine (TS puro)
 * avise a React sin importar React.
 */
type Listener<T> = (data: T) => void;

export class EventEmitter<Events extends Record<string, any>> {
  private listeners: { [K in keyof Events]?: Set<Listener<Events[K]>> } = {};

  on<K extends keyof Events>(event: K, cb: Listener<Events[K]>): () => void {
    (this.listeners[event] ??= new Set()).add(cb);
    // devuelve funcion para desuscribir
    return () => this.listeners[event]?.delete(cb);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]) {
    this.listeners[event]?.forEach((cb) => cb(data));
  }
}