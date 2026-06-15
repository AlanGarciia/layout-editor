import { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Transformer } from "react-konva";
import {
  Upload, Eye, EyeOff, Trash2, Layers, ChevronDown, ChevronRight, Download,
  ArrowUp, ArrowDown, Type, GripVertical, FileCode,
} from "lucide-react";

/*
 * LayerEditor
 * -----------
 * Sube un SVG y lo separa en capas (cada <g> o elemento de primer nivel = una capa).
 * Tambien permite anadir capas de texto, editables in situ (doble clic sobre el
 * texto seleccionado abre un textarea superpuesto en su posicion).
 *
 * Seleccion: SOLO desde el panel de capas (lateral derecho). Hacer clic o
 * arrastrar en el canvas nunca cambia que capa esta seleccionada.
 *
 * Reordenar: con las flechas de cada fila o arrastrando las filas del panel.
 *
 * Exportar:
 *   - PSD: rasteriza cada capa a PNG y lo manda al backend (FastAPI + psd-tools),
 *     que compone el .psd. La rotacion NO se aplica en el PSD.
 *   - SVG: todo en el frontend. Cada capa se envuelve en un <g> con su transform.
 *     La rotacion SI se aplica, y el texto sale como texto editable.
 *
 * Dependencias: react-konva, konva, lucide-react
 *   npm i react-konva konva lucide-react
 */

const API_URL = "http://localhost:8000";

// --- Utilidades de SVG -------------------------------------------------------

function splitSvgIntoLayers(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) throw new Error("No se encontro un elemento <svg> valido.");

  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("El SVG no se pudo leer (XML mal formado).");

  const viewBox = svg.getAttribute("viewBox");
  let width = parseFloat(svg.getAttribute("width")) || 0;
  let height = parseFloat(svg.getAttribute("height")) || 0;
  if ((!width || !height) && viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    width = width || parts[2];
    height = height || parts[3];
  }
  width = width || 512;
  height = height || 512;

  const rootAttrs = Array.from(svg.attributes)
    .map((a) => `${a.name}="${a.value}"`)
    .join(" ");

  const defs = Array.from(svg.querySelectorAll(":scope > defs"))
    .map((d) => d.outerHTML)
    .join("");

  const drawable = Array.from(svg.children).filter(
    (el) => el.tagName.toLowerCase() !== "defs"
  );

  const stamp = Date.now();
  const layers = drawable.map((el, i) => {
    const tag = el.tagName.toLowerCase();
    const label =
      el.getAttribute("id") ||
      el.getAttribute("inkscape:label") ||
      el.getAttribute("data-name") ||
      `${tag} ${i + 1}`;

    const single = `<svg ${rootAttrs}>${defs}${el.outerHTML}</svg>`;

    return {
      id: `layer-${stamp}-${i}`,
      name: label,
      tag,
      type: "image",
      svg: single,
      visible: true,
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      img: null,
    };
  });

  return { layers, width, height };
}

function svgToImage(svgString) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo rasterizar una capa."));
    };
    img.src = url;
  });
}

// Vuelca una capa a PNG base64. Maneja tanto imagenes (SVG) como texto.
function layerToPng(layer) {
  if (layer.type === "text") {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const fontSize = layer.fontSize * layer.scaleX;
    const lines = layer.text.split("\n");
    ctx.font = `${fontSize}px "DM Sans", sans-serif`;
    const widest = Math.max(1, ...lines.map((ln) => ctx.measureText(ln).width));
    const lineH = fontSize * 1.3;
    const w = Math.max(1, Math.ceil(widest) + 8);
    const h = Math.max(1, Math.ceil(lineH * lines.length));
    canvas.width = w;
    canvas.height = h;
    ctx.font = `${fontSize}px "DM Sans", sans-serif`;
    ctx.fillStyle = layer.fill;
    ctx.textBaseline = "top";
    lines.forEach((ln, i) => ctx.fillText(ln, 4, 4 + i * lineH));
    return canvas.toDataURL("image/png");
  }

  const w = Math.max(1, Math.round(layer.img.width * layer.scaleX));
  const h = Math.max(1, Math.round(layer.img.height * layer.scaleY));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(layer.img, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

// --- Capa individual en el canvas -------------------------------------------

function CanvasLayer({ layer, isSelected, onChange, onEditText, hidden }) {
  const ref = useRef();
  const trRef = useRef();

  useEffect(() => {
    if (isSelected && trRef.current && ref.current) {
      trRef.current.nodes([ref.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  if (!layer.visible || hidden) return null;

  const common = {
    ref,
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    draggable: isSelected,
    listening: isSelected, // las no seleccionadas ignoran clics y arrastres
    onDragEnd: (e) => onChange({ ...layer, x: e.target.x(), y: e.target.y() }),
    onTransformEnd: () => {
      const node = ref.current;
      onChange({
        ...layer,
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
      });
    },
  };

  return (
    <>
      {layer.type === "text" ? (
        <KonvaText
          {...common}
          text={layer.text}
          fontSize={layer.fontSize}
          fontFamily="DM Sans, sans-serif"
          fill={layer.fill}
          lineHeight={1.3}
          onDblClick={() => isSelected && onEditText(layer)}
          onDblTap={() => isSelected && onEditText(layer)}
        />
      ) : (
        layer.img && <KonvaImage {...common} image={layer.img} />
      )}
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 5 || newBox.height < 5 ? oldBox : newBox
          }
        />
      )}
    </>
  );
}

// --- Componente principal ----------------------------------------------------

export default function LayerEditor() {
  const [layers, setLayers] = useState([]);
  const [canvas, setCanvas] = useState({ width: 800, height: 600 });
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [editing, setEditing] = useState(null); // { id, value, style } o null
  const fileRef = useRef();
  const stageRef = useRef();
  const textareaRef = useRef();

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      if (file.type !== "image/svg+xml" && !file.name.endsWith(".svg")) {
        throw new Error("Por ahora solo se admiten archivos SVG.");
      }
      const text = await file.text();
      const { layers: parsed, width, height } = splitSvgIntoLayers(text);

      const withImages = await Promise.all(
        parsed.map(async (l) => ({ ...l, img: await svgToImage(l.svg) }))
      );

      setCanvas({ width, height });
      setLayers(withImages);
      setSelectedId(null);
    } catch (e) {
      setError(e.message);
      setLayers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  };

  const updateLayer = (updated) =>
    setLayers((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));

  const toggleVisible = (id) =>
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    );

  const removeLayer = (id) => {
    setLayers((prev) => prev.filter((l) => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // Mueve una capa una posicion arriba/abajo en el orden de pintado.
  const moveLayer = (id, dir) => {
    setLayers((prev) => {
      const i = prev.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  // Reordena arrastrando: coloca "fromId" en la posicion de "toId".
  const reorderLayers = (fromId, toId) => {
    if (fromId === toId) return;
    setLayers((prev) => {
      const from = prev.findIndex((l) => l.id === fromId);
      const to = prev.findIndex((l) => l.id === toId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const addText = () => {
    const id = `layer-text-${Date.now()}`;
    const newLayer = {
      id,
      name: "Texto",
      tag: "text",
      type: "text",
      text: "Escribe aqui",
      fontSize: 48,
      fill: "#15171c",
      x: canvas.width / 2 - 100,
      y: canvas.height / 2 - 24,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      visible: true,
      img: null,
    };
    setLayers((prev) => [...prev, newLayer]);
    setSelectedId(id);
    setTimeout(() => startEditing(newLayer), 0);
  };

  // Abre el textarea superpuesto sobre el nodo de texto
  const startEditing = (layer) => {
    const scale = currentScale();
    setEditing({
      id: layer.id,
      value: layer.text,
      style: {
        left: layer.x * scale,
        top: layer.y * scale,
        fontSize: layer.fontSize * layer.scaleX * scale,
        color: layer.fill,
        transform: layer.rotation ? `rotate(${layer.rotation}deg)` : "none",
        transformOrigin: "left top",
      },
    });
  };

  const commitEditing = () => {
    if (!editing) return;
    const value = editing.value;
    setLayers((prev) =>
      prev.map((l) =>
        l.id === editing.id
          ? { ...l, text: value, name: value.split("\n")[0].slice(0, 20) || "Texto" }
          : l
      )
    );
    setEditing(null);
  };

  const cancelEditing = () => setEditing(null);

  // Enfoca el textarea SOLO al abrirlo (depende del id, no del objeto entero;
  // si dependiera de `editing`, se re-seleccionaria todo en cada tecla y solo
  // quedaria la ultima letra).
  useEffect(() => {
    if (editing && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      ta.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

  // Exporta a PSD via backend (rasteriza cada capa a PNG)
  const exportPsd = async () => {
    if (layers.length === 0) return;
    setError(null);
    setExporting(true);
    try {
      const payload = {
        width: canvas.width,
        height: canvas.height,
        layers: layers.map((l) => ({
          name: l.name,
          png: layerToPng(l),
          x: l.x,
          y: l.y,
          visible: l.visible,
        })),
      };

      const res = await fetch(`${API_URL}/export/psd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "export.psd";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`No se pudo exportar: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  // Exporta a SVG: cada capa se envuelve en un <g> con su transformacion.
  // Las capas de imagen reusan su SVG original; las de texto generan un <text>.
  const exportSvg = () => {
    if (layers.length === 0) return;

    const esc = (s) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const parts = layers
      .filter((l) => l.visible)
      .map((l) => {
        const t = `translate(${l.x} ${l.y}) rotate(${l.rotation}) scale(${l.scaleX} ${l.scaleY})`;

        if (l.type === "text") {
          const lines = l.text.split("\n");
          const tspans = lines
            .map((ln, i) =>
              `<tspan x="0" dy="${i === 0 ? l.fontSize : l.fontSize * 1.3}">${esc(ln)}</tspan>`
            )
            .join("");
          return `<g transform="${t}"><text font-family="DM Sans, sans-serif" font-size="${l.fontSize}" fill="${l.fill}">${tspans}</text></g>`;
        }

        // capa de imagen: extrae el contenido interno del SVG original
        const inner = l.svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
        return `<g transform="${t}">${inner}</g>`;
      })
      .join("\n  ");

    const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
  ${parts}
</svg>`;

    const blob = new Blob([doc], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "export.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxW = 720;
  const maxH = 540;
  const currentScale = () => Math.min(maxW / canvas.width, maxH / canvas.height, 1);
  const scale = currentScale();

  const hasContent = layers.length > 0;
  const editingLayer = editing ? layers.find((l) => l.id === editing.id) : null;

  return (
    <div className="ed-root">
      <style>{styles}</style>

      <header className="ed-header">
        <div className="ed-brand">
          <Layers size={18} strokeWidth={2.5} />
          <span>Layer Editor</span>
        </div>
        <button className="ed-btn" onClick={() => fileRef.current?.click()}>
          <Upload size={15} /> Subir SVG
        </button>
        <button className="ed-btn ed-btn-ghost" onClick={addText}>
          <Type size={15} /> Anadir texto
        </button>
        <button
          className="ed-btn ed-btn-ghost"
          onClick={exportSvg}
          disabled={!hasContent}
        >
          <FileCode size={15} /> Exportar SVG
        </button>
        <button
          className="ed-btn ed-btn-ghost"
          onClick={exportPsd}
          disabled={!hasContent || exporting}
        >
          <Download size={15} /> {exporting ? "Exportando..." : "Exportar PSD"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".svg,image/svg+xml"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </header>

      <div className="ed-body">
        {/* Lienzo */}
        <main className="ed-canvas-wrap" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
          {!hasContent ? (
            <div className="ed-empty">
              {loading ? (
                <p>Separando capas...</p>
              ) : (
                <>
                  <Upload size={32} strokeWidth={1.5} />
                  <p>Arrastra un SVG aqui o usa "Subir SVG".</p>
                  <span>Cada grupo del SVG se convierte en una capa editable. Selecciona capas en el panel derecho.</span>
                </>
              )}
              {error && <p className="ed-error">{error}</p>}
            </div>
          ) : (
            <>
              <div
                className="ed-stage-frame"
                style={{ width: canvas.width * scale, height: canvas.height * scale, position: "relative" }}
              >
                <Stage
                  ref={stageRef}
                  width={canvas.width}
                  height={canvas.height}
                  scaleX={scale}
                  scaleY={scale}
                  style={{ width: canvas.width * scale, height: canvas.height * scale }}
                >
                  <Layer>
                    {layers.map((l) => (
                      <CanvasLayer
                        key={l.id}
                        layer={l}
                        isSelected={l.id === selectedId}
                        onChange={updateLayer}
                        onEditText={startEditing}
                        hidden={editing && editing.id === l.id}
                      />
                    ))}
                  </Layer>
                </Stage>

                {/* Textarea superpuesto para editar texto in situ */}
                {editing && editingLayer && (
                  <textarea
                    ref={textareaRef}
                    className="ed-text-edit"
                    style={editing.style}
                    value={editing.value}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev, value: e.target.value }))
                    }
                    onBlur={commitEditing}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        commitEditing();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancelEditing();
                      }
                    }}
                  />
                )}
              </div>
              {error && <p className="ed-error ed-error-float">{error}</p>}
            </>
          )}
        </main>

        {/* Panel de capas */}
        <aside className={`ed-panel ${panelOpen ? "" : "ed-panel-collapsed"}`}>
          <button className="ed-panel-head" onClick={() => setPanelOpen((o) => !o)}>
            {panelOpen ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            <span>Capas {layers.length > 0 && `(${layers.length})`}</span>
          </button>
          {panelOpen && (
            <ul className="ed-layer-list">
              {layers.length === 0 && <li className="ed-layer-none">Sin capas</li>}
              {[...layers].reverse().map((l) => (
                <li
                  key={l.id}
                  draggable
                  className={`ed-layer ${l.id === selectedId ? "ed-layer-sel" : ""} ${
                    l.id === dragOverId && dragId !== l.id ? "ed-layer-over" : ""
                  } ${l.id === dragId ? "ed-layer-dragging" : ""}`}
                  onClick={() => setSelectedId(l.id)}
                  onDragStart={(e) => {
                    setDragId(l.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (l.id !== dragOverId) setDragOverId(l.id);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragId) reorderLayers(dragId, l.id);
                    setDragId(null);
                    setDragOverId(null);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setDragOverId(null);
                  }}
                >
                  <span className="ed-grip" title="Arrastra para reordenar">
                    <GripVertical size={14} />
                  </span>
                  <button
                    className="ed-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVisible(l.id);
                    }}
                    title={l.visible ? "Ocultar" : "Mostrar"}
                  >
                    {l.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <span className="ed-layer-name">{l.name}</span>
                  <span className="ed-layer-tag">{l.tag}</span>
                  <button
                    className="ed-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLayer(l.id, 1);
                    }}
                    title="Subir"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    className="ed-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLayer(l.id, -1);
                    }}
                    title="Bajar"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    className="ed-icon ed-icon-del"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLayer(l.id);
                    }}
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}

const styles = `
  .ed-root { --bg:#15171c; --panel:#1d2027; --line:#2a2e38; --txt:#e6e8ec;
    --muted:#8b90a0; --accent:#4d9d84; --sel:#2a3a35; --danger:#ef7766;
    display:flex; flex-direction:column; height:100%; min-height:560px;
    background:var(--bg); color:var(--txt); border-radius:12px; overflow:hidden;
    font-family:'DM Sans',system-ui,sans-serif; border:1px solid var(--line); }
  .ed-header { display:flex; align-items:center; gap:10px; padding:12px 16px;
    border-bottom:1px solid var(--line); background:var(--panel); flex-wrap:wrap; }
  .ed-brand { display:flex; align-items:center; gap:8px; font-weight:600;
    letter-spacing:-.01em; color:var(--accent); margin-right:auto; }
  .ed-brand span { color:var(--txt); }
  .ed-btn { display:inline-flex; align-items:center; gap:7px;
    background:var(--accent); color:#0c0d10; border:0; padding:8px 14px;
    border-radius:8px; font-weight:600; font-size:13px; cursor:pointer; }
  .ed-btn:hover:not(:disabled) { filter:brightness(1.08); }
  .ed-btn:disabled { opacity:.45; cursor:not-allowed; }
  .ed-btn-ghost { background:transparent; color:var(--txt);
    box-shadow:inset 0 0 0 1px var(--line); }
  .ed-btn-ghost:hover:not(:disabled) { background:#23262f; filter:none; }
  .ed-body { display:flex; flex:1; min-height:0; }
  .ed-canvas-wrap { flex:1; position:relative; display:flex; align-items:center;
    justify-content:center; padding:24px; background:
      linear-gradient(45deg,#1a1c22 25%,transparent 25%) -8px 0/16px 16px,
      linear-gradient(-45deg,#1a1c22 25%,transparent 25%) -8px 0/16px 16px,
      linear-gradient(45deg,transparent 75%,#1a1c22 75%) -8px 0/16px 16px,
      linear-gradient(-45deg,transparent 75%,#1a1c22 75%) -8px 0/16px 16px,
      var(--bg); }
  .ed-stage-frame { box-shadow:0 0 0 1px var(--line),0 8px 30px rgba(0,0,0,.4);
    background:#fff; }
  .ed-text-edit { position:absolute; margin:0; padding:4px; border:1px dashed var(--accent);
    background:rgba(255,255,255,.85); outline:none; resize:none; overflow:hidden;
    font-family:'DM Sans',sans-serif; line-height:1.3; white-space:pre;
    min-width:40px; border-radius:2px; }
  .ed-empty { display:flex; flex-direction:column; align-items:center; gap:8px;
    color:var(--muted); text-align:center; max-width:340px; }
  .ed-empty p { margin:6px 0 0; color:var(--txt); font-weight:500; }
  .ed-empty span { font-size:13px; }
  .ed-error { color:var(--danger)!important; font-weight:500; }
  .ed-error-float { position:absolute; bottom:12px; left:50%;
    transform:translateX(-50%); background:#2a1c1e; padding:8px 14px;
    border-radius:8px; font-size:13px; box-shadow:0 0 0 1px var(--danger); }
  .ed-panel { width:280px; border-left:1px solid var(--line); background:var(--panel);
    display:flex; flex-direction:column; transition:width .15s; }
  .ed-panel-collapsed { width:120px; }
  .ed-panel-head { display:flex; align-items:center; gap:6px; width:100%;
    padding:12px 14px; background:transparent; border:0; border-bottom:1px solid var(--line);
    color:var(--txt); font-weight:600; font-size:13px; cursor:pointer; }
  .ed-layer-list { list-style:none; margin:0; padding:6px; overflow-y:auto; flex:1; }
  .ed-layer-none { color:var(--muted); font-size:13px; padding:10px; }
  .ed-layer { display:flex; align-items:center; gap:6px; padding:8px 9px;
    border-radius:7px; cursor:pointer; font-size:13px; border:1px solid transparent; }
  .ed-layer:hover { background:#23262f; }
  .ed-layer-sel { background:var(--sel); box-shadow:inset 0 0 0 1px var(--accent); }
  .ed-layer-over { border-top:2px solid var(--accent); }
  .ed-layer-dragging { opacity:.4; }
  .ed-layer-name { flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    min-width:0; }
  .ed-layer-tag { font-size:11px; color:var(--muted); font-family:'JetBrains Mono',monospace;
    background:#0f1116; padding:2px 6px; border-radius:4px; }
  .ed-grip { display:flex; color:var(--muted); cursor:grab; flex-shrink:0; }
  .ed-grip:active { cursor:grabbing; }
  .ed-icon { background:transparent; border:0; color:var(--muted); cursor:pointer;
    display:flex; padding:2px; border-radius:4px; flex-shrink:0; }
  .ed-icon:hover { color:var(--txt); }
  .ed-icon-del:hover { color:var(--danger); }
`;
