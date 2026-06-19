"use client";

import { useEffect, useRef, useState } from "react";
import { EditorEngine } from "@/editor-engine/EditorEngine";
import type { LayerData } from "@/editor-engine/types";

/*
 * EditorCanvas: el unico puente React <-> engine.
 * - Monta el engine UNA vez (en un ref, no en estado).
 * - Se suscribe a los eventos del engine para refrescar la UI
 *   (panel de capas, seleccion), NO el canvas.
 * - El canvas lo dibuja Konva via el engine; React no lo toca.
 */
export default function EditorCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<EditorEngine | null>(null);

  // estos states SOLO sirven para la UI (panel lateral), no para el canvas
  const [layers, setLayers] = useState<LayerData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new EditorEngine(containerRef.current, 800, 600);
    engineRef.current = engine;

    // el engine avisa cuando cambia algo "de UI" (no en cada frame de drag)
    const offChange = engine.on("change", () => {
      setLayers(engine.getLayersSnapshot());
    });
    const offSel = engine.on("selection", (id) => {
      setSelectedId(id);
    });

    return () => {
      offChange();
      offSel();
      engine.destroy();
    };
  }, []);

  // ejemplo: un boton de la toolbar llama al engine
  const handleAddImage = (src: string) => {
    engineRef.current?.addLayer({
      id: `layer-${Date.now()}`,
      name: "Imagen",
      type: "image",
      src,
      x: 50,
      y: 50,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      visible: true,
    });
  };

  return (
    <div style={{ display: "flex" }}>
      {/* el canvas vive aqui; React solo provee el div */}
      <div ref={containerRef} style={{ flex: 1, background: "#fff" }} />

      {/* panel de capas: lee el snapshot, NO controla el canvas */}
      <aside style={{ width: 280 }}>
        {layers.map((l) => (
          <div
            key={l.id}
            onClick={() => engineRef.current?.selectLayer(l.id)}
            style={{ fontWeight: l.id === selectedId ? "bold" : "normal" }}
          >
            {l.name}
          </div>
        ))}
      </aside>
    </div>
  );
}