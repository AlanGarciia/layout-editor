import { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Transformer } from "react-konva";
import {
  Upload, Eye, EyeOff, Trash2, Layers, ChevronDown, ChevronRight, Download,
  ArrowUp, ArrowDown, Type, GripVertical, FileCode, ImagePlus, Blend, Settings2,
} from "lucide-react";

/*
 * LayerEditor
 * -----------
 * Editor de capas: separa SVG, anade PNG/JPG y texto, separa imagenes por color,
 * y permite mover/escalar/rotar/reordenar capas.
 *
 * Panel de propiedades (abajo del panel de capas, al seleccionar una capa):
 *   - renombrar
 *   - opacidad
 *   - (texto) tamano de fuente y color
 *
 * Seleccion: SOLO desde el panel de capas.
 * Exportar: PSD (backend) y SVG (frontend). Ambos respetan opacidad.
 *
 * Dependencias: react-konva, konva, lucide-react
 */

const API_URL = "http://localhost:8000";

// --- Utilidades de SVG / imagen ----------------------------------------------

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
      opacity: 1,
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

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo cargar la imagen."));
    };
    img.src = url;
  });
}

function imageToDataUrl(img, w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

// Vuelca una capa a PNG base64. Maneja imagenes (SVG/PNG) y texto.
// Aplica la opacidad de la capa al rasterizar (para el export PSD).
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
    ctx.globalAlpha = layer.opacity ?? 1;
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
  ctx.globalAlpha = layer.opacity ?? 1;
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
    opacity: layer.opacity ?? 1,
    draggable: isSelected,
    listening: isSelected,
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

// --- Panel de propiedades ----------------------------------------------------

function PropertiesPanel({ layer, onChange }) {
  if (!layer) {
    return <div className="ed-props ed-props-empty">Selecciona una capa para ver sus propiedades.</div>;
  }

  const opacityPct = Math.round((layer.opacity ?? 1) * 100);

  return (
    <div className="ed-props">
      <div className="ed-props-title">
        <Settings2 size={14} /> Propiedades
      </div>

      <label className="ed-field">
        <span>Nombre</span>
        <input
          type="text"
          value={layer.name}
          onChange={(e) => onChange({ ...layer, name: e.target.value })}
        />
      </label>

      <label className="ed-field">
        <span>Opacidad: {opacityPct}%</span>
        <input
          type="range"
          min="0"
          max="100"
          value={opacityPct}
          onChange={(e) => onChange({ ...layer, opacity: Number(e.target.value) / 100 })}
        />
      </label>

      {layer.type === "text" && (
        <>
          <label className="ed-field">
            <span>Tamano: {layer.fontSize}px</span>
            <input
              type="range"
              min="8"
              max="200"
              value={layer.fontSize}
              onChange={(e) => onChange({ ...layer, fontSize: Number(e.target.value) })}
            />
          </label>
          <label className="ed-field">
            <span>Color</span>
            <input
              type="color"
              value={layer.fill}
              onChange={(e) => onChange({ ...layer, fill: e.target.value })}
            />
          </label>
        </>
      )}
    </div>
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
  const [editing, setEditing] = useState(null);
  const [renamingId, setRenamingId] = useState(null); // capa cuyo nombre se edita en la lista
  const fileRef = useRef();
  const imgRef = useRef();
  const stageRef = useRef();
  const textareaRef = useRef();

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      if (file.type !== "image/svg+xml" && !file.name.endsWith(".svg")) {
        throw new Error("Ese boton es para SVG. Usa 'Anadir imagen' para PNG/JPG.");
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

  const addImage = useCallback(async (file) => {
    if (!file) return;
    setError(null);
    try {
      const img = await fileToImage(file);

      let cw = canvas.width;
      let ch = canvas.height;
      if (layers.length === 0) {
        cw = img.width;
        ch = img.height;
        setCanvas({ width: cw, height: ch });
      }

      const id = `layer-img-${Date.now()}`;
      const name = file.name.replace(/\.[^.]+$/, "");
      setLayers((prev) => [
        ...prev,
        {
          id,
          name: name || "Imagen",
          tag: "png",
          type: "image",
          svg: null,
          img,
          file,
          visible: true,
          opacity: 1,
          x: Math.max(0, (cw - img.width) / 2),
          y: Math.max(0, (ch - img.height) / 2),
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        },
      ]);
      setSelectedId(id);
    } catch (e) {
      setError(e.message);
    }
  }, [canvas.width, canvas.height, layers.length]);

  const splitByColor = async (layer) => {
    if (!layer || !layer.file) {
      setError("Esta capa no se puede separar (sin archivo original).");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", layer.file);
      form.append("n_colors", "12");
      form.append("merge_dist", "50");
      form.append("min_percent", "1.5");

      const res = await fetch(`${API_URL}/layers/split-color`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      if (!data.layers || data.layers.length === 0) {
        throw new Error("El backend no devolvio capas.");
      }

      const stamp = Date.now();
      const loadImg = (dataUrl) =>
        new Promise((resolve, reject) => {
          const im = new window.Image();
          im.onload = () => resolve(im);
          im.onerror = () => reject(new Error("Imagen de capa invalida"));
          im.src = dataUrl;
        });

      const newLayers = [];
      for (let i = 0; i < data.layers.length; i++) {
        const cl = data.layers[i];
        const img = await loadImg(cl.png);
        newLayers.push({
          id: `layer-color-${stamp}-${i}`,
          name: cl.name,
          tag: "color",
          type: "image",
          svg: null,
          img,
          file: null,
          visible: true,
          opacity: 1,
          x: 0,
          y: 0,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        });
      }

      setLayers((prev) => {
        const idx = prev.findIndex((l) => l.id === layer.id);
        if (idx < 0) return [...prev, ...newLayers];
        const next = [...prev];
        next.splice(idx, 1, ...newLayers);
        return next;
      });
      setSelectedId(newLayers[0].id);
      setDragId(null);
      setDragOverId(null);
    } catch (e) {
      setError(`No se pudo separar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const isSvg = file.type === "image/svg+xml" || file.name.endsWith(".svg");
    if (isSvg) handleFile(file);
    else addImage(file);
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
      opacity: 1,
      img: null,
    };
    setLayers((prev) => [...prev, newLayer]);
    setSelectedId(id);
    setTimeout(() => startEditing(newLayer), 0);
  };

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

  useEffect(() => {
    if (editing && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      ta.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

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

  const exportSvg = () => {
    if (layers.length === 0) return;

    const esc = (s) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const parts = layers
      .filter((l) => l.visible)
      .map((l) => {
        const op = (l.opacity ?? 1) < 1 ? ` opacity="${l.opacity}"` : "";
        const t = `translate(${l.x} ${l.y}) rotate(${l.rotation}) scale(${l.scaleX} ${l.scaleY})`;

        if (l.type === "text") {
          const lines = l.text.split("\n");
          const tspans = lines
            .map((ln, i) =>
              `<tspan x="0" dy="${i === 0 ? l.fontSize : l.fontSize * 1.3}">${esc(ln)}</tspan>`
            )
            .join("");
          return `<g transform="${t}"${op}><text font-family="DM Sans, sans-serif" font-size="${l.fontSize}" fill="${l.fill}">${tspans}</text></g>`;
        }

        if (l.svg) {
          const inner = l.svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
          return `<g transform="${t}"${op}>${inner}</g>`;
        }

        if (l.img) {
          const w = l.img.width;
          const h = l.img.height;
          const href = imageToDataUrl(l.img, w, h);
          return `<g transform="${t}"${op}><image width="${w}" height="${h}" href="${href}"/></g>`;
        }

        return "";
      })
      .join("\n  ");

    const doc = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
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
  const selectedLayer = layers.find((l) => l.id === selectedId);
  const canSplit = selectedLayer && selectedLayer.type === "image" && selectedLayer.file;

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
        <button className="ed-btn ed-btn-ghost" onClick={() => imgRef.current?.click()}>
          <ImagePlus size={15} /> Anadir imagen
        </button>
        <button className="ed-btn ed-btn-ghost" onClick={addText}>
          <Type size={15} /> Anadir texto
        </button>
        {canSplit && (
          <button className="ed-btn ed-btn-ghost" onClick={() => splitByColor(selectedLayer)}>
            <Blend size={15} /> Separar por color
          </button>
        )}
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
        <input
          ref={imgRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => addImage(e.target.files?.[0])}
        />
      </header>

      <div className="ed-body">
        <main className="ed-canvas-wrap" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
          {!hasContent ? (
            <div className="ed-empty">
              {loading ? (
                <p>Procesando...</p>
              ) : (
                <>
                  <Upload size={32} strokeWidth={1.5} />
                  <p>Arrastra un SVG o una imagen aqui.</p>
                  <span>El SVG se separa en capas; los PNG/JPG entran como una capa que puedes separar por color. Tambien puedes anadir texto.</span>
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

        <aside className={`ed-panel ${panelOpen ? "" : "ed-panel-collapsed"}`}>
          <button className="ed-panel-head" onClick={() => setPanelOpen((o) => !o)}>
            {panelOpen ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            <span>Capas {layers.length > 0 && `(${layers.length})`}</span>
          </button>
          {panelOpen && (
            <>
              <ul className="ed-layer-list">
                {layers.length === 0 && <li className="ed-layer-none">Sin capas</li>}
                {[...layers].reverse().map((l) => (
                  <li
                    key={l.id}
                    draggable={renamingId !== l.id}
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

                    {renamingId === l.id ? (
                      <input
                        className="ed-rename"
                        autoFocus
                        defaultValue={l.name}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => {
                          updateLayer({ ...l, name: e.target.value || l.name });
                          setRenamingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            updateLayer({ ...l, name: e.target.value || l.name });
                            setRenamingId(null);
                          } else if (e.key === "Escape") {
                            setRenamingId(null);
                          }
                        }}
                      />
                    ) : (
                      <span
                        className="ed-layer-name"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setRenamingId(l.id);
                        }}
                        title="Doble clic para renombrar"
                      >
                        {l.name}
                      </span>
                    )}

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

              <PropertiesPanel layer={selectedLayer} onChange={updateLayer} />
            </>
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
    background:#fff; overflow:hidden; position:relative; }
  .ed-text-edit { position:absolute; margin:0; padding:4px; border:1px dashed var(--accent);
    background:rgba(255,255,255,.85); outline:none; resize:none; overflow:hidden;
    font-family:'DM Sans',sans-serif; line-height:1.3; white-space:pre;
    min-width:40px; border-radius:2px; }
  .ed-empty { display:flex; flex-direction:column; align-items:center; gap:8px;
    color:var(--muted); text-align:center; max-width:360px; }
  .ed-empty p { margin:6px 0 0; color:var(--txt); font-weight:500; }
  .ed-empty span { font-size:13px; }
  .ed-error { color:var(--danger)!important; font-weight:500; }
  .ed-error-float { position:absolute; bottom:12px; left:50%;
    transform:translateX(-50%); background:#2a1c1e; padding:8px 14px;
    border-radius:8px; font-size:13px; box-shadow:0 0 0 1px var(--danger); }
  .ed-panel { width:300px; border-left:1px solid var(--line); background:var(--panel);
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
  .ed-rename { flex:1; min-width:0; background:#0f1116; border:1px solid var(--accent);
    color:var(--txt); border-radius:4px; padding:3px 6px; font-size:13px;
    font-family:inherit; outline:none; }
  .ed-layer-tag { font-size:11px; color:var(--muted); font-family:'JetBrains Mono',monospace;
    background:#0f1116; padding:2px 6px; border-radius:4px; }
  .ed-grip { display:flex; color:var(--muted); cursor:grab; flex-shrink:0; }
  .ed-grip:active { cursor:grabbing; }
  .ed-icon { background:transparent; border:0; color:var(--muted); cursor:pointer;
    display:flex; padding:2px; border-radius:4px; flex-shrink:0; }
  .ed-icon:hover { color:var(--txt); }
  .ed-icon-del:hover { color:var(--danger); }
  .ed-props { border-top:1px solid var(--line); padding:12px 14px;
    display:flex; flex-direction:column; gap:12px; }
  .ed-props-empty { color:var(--muted); font-size:13px; }
  .ed-props-title { display:flex; align-items:center; gap:6px; font-weight:600;
    font-size:13px; color:var(--accent); }
  .ed-field { display:flex; flex-direction:column; gap:5px; font-size:12.5px;
    color:var(--muted); }
  .ed-field input[type=text] { background:#0f1116; border:1px solid var(--line);
    color:var(--txt); border-radius:6px; padding:7px 9px; font-size:13px;
    font-family:inherit; outline:none; }
  .ed-field input[type=text]:focus { border-color:var(--accent); }
  .ed-field input[type=range] { width:100%; accent-color:var(--accent); }
  .ed-field input[type=color] { width:44px; height:30px; padding:0; border:1px solid var(--line);
    border-radius:6px; background:none; cursor:pointer; }
`;