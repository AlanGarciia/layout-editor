"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useSearchParams } from "next/navigation";
import NewProjectScreen, { type CanvasChoice } from "./NewProjectScreen";
import { useTranslations } from "next-intl";
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Transformer, Rect } from "react-konva";
import {
  Upload, Eye, EyeOff, Trash2, Layers, ChevronDown, ChevronRight, Download,
  ArrowUp, ArrowDown, Type, GripVertical, FileCode, ImagePlus, Blend, Settings2,
  Undo2, Redo2, Copy,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const HISTORY_LIMIT = 50;

type LayerType = "image" | "text";

interface EditorLayer {
  id: string;
  name: string;
  tag: string;
  type: LayerType;
  svg?: string | null;
  img?: HTMLImageElement | null;
  file?: File | null;
  png?: string | null;
  visible: boolean;
  opacity: number;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  text?: string;
  fontSize?: number;
  fill?: string;
}

interface CanvasSize {
  width: number;
  height: number;
}

interface EditingState {
  id: string;
  value: string;
  style: React.CSSProperties;
}

function splitSvgIntoLayers(svgText: string): { layers: EditorLayer[]; width: number; height: number } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) throw new Error("No se encontro un elemento <svg> valido.");

  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("El SVG no se pudo leer (XML mal formado).");

  const viewBox = svg.getAttribute("viewBox");
  let width = parseFloat(svg.getAttribute("width") || "") || 0;
  let height = parseFloat(svg.getAttribute("height") || "") || 0;
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
  const layers: EditorLayer[] = drawable.map((el, i) => {
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

function svgToImage(svgString: string): Promise<HTMLImageElement> {
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

function fileToImage(file: Blob): Promise<HTMLImageElement> {
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

function dataUrlToImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new window.Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("Imagen de capa invalida"));
    im.src = dataUrl;
  });
}

function imageToDataUrl(img: HTMLImageElement, w: number, h: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

function layerToPng(layer: EditorLayer): string {
  if (layer.type === "text") {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const fontSize = (layer.fontSize || 48) * layer.scaleX;
    const lines = (layer.text || "").split("\n");
    ctx.font = `${fontSize}px "DM Sans", sans-serif`;
    const widest = Math.max(1, ...lines.map((ln) => ctx.measureText(ln).width));
    const lineH = fontSize * 1.3;
    const w = Math.max(1, Math.ceil(widest) + 8);
    const h = Math.max(1, Math.ceil(lineH * lines.length));
    canvas.width = w;
    canvas.height = h;
    ctx.globalAlpha = layer.opacity ?? 1;
    ctx.font = `${fontSize}px "DM Sans", sans-serif`;
    ctx.fillStyle = layer.fill || "#000000";
    ctx.textBaseline = "top";
    lines.forEach((ln, i) => ctx.fillText(ln, 4, 4 + i * lineH));
    return canvas.toDataURL("image/png");
  }

  const image = layer.img!;
  const w = Math.max(1, Math.round(image.width * layer.scaleX));
  const h = Math.max(1, Math.round(image.height * layer.scaleY));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.globalAlpha = layer.opacity ?? 1;
  ctx.drawImage(image, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

interface CanvasLayerProps {
  layer: EditorLayer;
  isSelected: boolean;
  onChange: (l: EditorLayer) => void;
  onCommit: (l: EditorLayer) => void;
  onEditText: (l: EditorLayer) => void;
  hidden: boolean;
}

const CanvasLayer = memo(function CanvasLayer({ layer, isSelected, onChange, onCommit, onEditText, hidden }: CanvasLayerProps) {
  const ref = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && ref.current) {
      trRef.current.nodes([ref.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  if (!layer.visible || hidden) return null;

  const common: any = {
    ref,
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    opacity: layer.opacity ?? 1,
    draggable: isSelected,
    listening: isSelected,
    perfectDrawEnabled: false,
    shadowForStrokeEnabled: false,
    onDragEnd: (e: any) => onCommit({ ...layer, x: e.target.x(), y: e.target.y() }),
    onTransformEnd: () => {
      const node = ref.current;
      onCommit({
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
          boundBoxFunc={(oldBox: any, newBox: any) =>
            newBox.width < 5 || newBox.height < 5 ? oldBox : newBox
          }
        />
      )}
    </>
  );
}, (prev, next) => {
  return (
    prev.isSelected === next.isSelected &&
    prev.hidden === next.hidden &&
    prev.layer === next.layer &&
    prev.onChange === next.onChange &&
    prev.onCommit === next.onCommit &&
    prev.onEditText === next.onEditText
  );
});

function PropertiesPanel({
  layer,
  onChange,
  onCommit,
  t,
}: {
  layer?: EditorLayer;
  onChange: (l: EditorLayer) => void;
  onCommit: (l: EditorLayer) => void;
  t: (k: string) => string;
}) {
  if (!layer) {
    return <div className="ed-props ed-props-empty">{t("selectLayer")}</div>;
  }

  const opacityPct = Math.round((layer.opacity ?? 1) * 100);

  return (
    <div className="ed-props">
      <div className="ed-props-title">
        <Settings2 size={14} /> {t("properties")}
      </div>

      <label className="ed-field">
        <span>{t("name")}</span>
        <input
          type="text"
          value={layer.name}
          onChange={(e) => onChange({ ...layer, name: e.target.value })}
          onBlur={(e) => onCommit({ ...layer, name: e.target.value })}
        />
      </label>

      <label className="ed-field">
        <span>{t("opacity")}: {opacityPct}%</span>
        <input
          type="range"
          min="0"
          max="100"
          value={opacityPct}
          onChange={(e) => onChange({ ...layer, opacity: Number(e.target.value) / 100 })}
          onMouseUp={(e) => onCommit({ ...layer, opacity: Number((e.target as HTMLInputElement).value) / 100 })}
          onTouchEnd={(e) => onCommit({ ...layer, opacity: Number((e.target as HTMLInputElement).value) / 100 })}
        />
      </label>

      {layer.type === "text" && (
        <>
          <label className="ed-field">
            <span>{t("size")}: {layer.fontSize}px</span>
            <input
              type="range"
              min="8"
              max="200"
              value={layer.fontSize}
              onChange={(e) => onChange({ ...layer, fontSize: Number(e.target.value) })}
              onMouseUp={(e) => onCommit({ ...layer, fontSize: Number((e.target as HTMLInputElement).value) })}
              onTouchEnd={(e) => onCommit({ ...layer, fontSize: Number((e.target as HTMLInputElement).value) })}
            />
          </label>
          <label className="ed-field">
            <span>{t("color")}</span>
            <input
              type="color"
              value={layer.fill}
              onChange={(e) => onChange({ ...layer, fill: e.target.value })}
              onBlur={(e) => onCommit({ ...layer, fill: e.target.value })}
            />
          </label>
        </>
      )}
    </div>
  );
}

export default function LayerEditor() {
  const t = useTranslations("editor");
  const [layers, setLayers] = useState<EditorLayer[]>([]);
  const [canvas, setCanvas] = useState<CanvasSize>({ width: 800, height: 600 });
  // lienzo elegido en la pantalla de nuevo proyecto (null = aun no elegido)
  const [canvasChoice, setCanvasChoice] = useState<CanvasChoice | null>(null);
  const canvasMode = canvasChoice?.mode ?? "free";

  // al elegir lienzo en la pantalla de nuevo proyecto
  const handleCreateCanvas = (choice: CanvasChoice) => {
    setCanvasChoice(choice);
    if (choice.mode === "fixed") {
      setCanvas({ width: choice.width, height: choice.height });
    }
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  // Zoom/pan: viven en refs (no en estado) para no re-renderizar al hacer zoom.
  // Solo guardamos un "tick" para refrescar la UI (indicador de %) cuando hace falta.
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const spacePressedRef = useRef(false);
  const [zoomLabel, setZoomLabel] = useState(100);
  // refs espejo para usar dentro de los listeners nativos sin dependencias
  const fitScaleRef = useRef(1);
  const editingRef = useRef(false);

  const [past, setPast] = useState<EditorLayer[][]>([]);
  const [future, setFuture] = useState<EditorLayer[][]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const searchParams = useSearchParams();

  const commit = useCallback(
    (updater: EditorLayer[] | ((prev: EditorLayer[]) => EditorLayer[])) => {
      setLayers((prev) => {
        const next = typeof updater === "function" ? (updater as any)(prev) : updater;
        setPast((p) => {
          const np = [...p, prev];
          return np.length > HISTORY_LIMIT ? np.slice(np.length - HISTORY_LIMIT) : np;
        });
        setFuture([]);
        return next;
      });
    },
    []
  );

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const previous = p[p.length - 1];
      setLayers((current) => {
        setFuture((f) => [current, ...f]);
        return previous;
      });
      return p.slice(0, -1);
    });
    setEditing(null);
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setLayers((current) => {
        setPast((p) => [...p, current]);
        return next;
      });
      return f.slice(1);
    });
    setEditing(null);
  }, []);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;

      // Supr / Backspace: borrar la capa seleccionada (sin Ctrl)
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        removeLayer(selectedId);
        return;
      }

      if (!mod) return;

      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      } else if (key === "d" && selectedId) {
        e.preventDefault();
        duplicateLayer(selectedId);
      } else if (key === "c" && selectedId) {
        e.preventDefault();
        copyLayer(selectedId);
      } else if (key === "v") {
        e.preventDefault();
        pasteLayer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, selectedId, layers]);

  // --- Zoom y pan (fuera de React): manipulan el Stage de Konva directamente ---
  // No usan setState en cada evento, por eso no provocan re-renders del canvas.
  useEffect(() => {
    // El Stage de Konva puede no estar montado en el primer render tras
    // elegir lienzo. Reintentamos en el siguiente frame hasta que exista,
    // asi el zoom/pan se engancha siempre (sin depender del timing exacto).
    let rafId = 0;
    let detach: (() => void) | null = null;

    const ZOOM_MIN = 0.2;
    const ZOOM_MAX = 8;

    // aplica el zoom/pan actual al Stage sin pasar por React
    const applyTransform = () => {
      const st = stageRef.current;
      if (!st) return;
      const eff = fitScaleRef.current * zoomRef.current;
      st.scale({ x: eff, y: eff });
      st.position({ x: panRef.current.x, y: panRef.current.y });
      st.batchDraw();
    };

    // zoom con rueda, centrado en el cursor (estilo Figma)
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = stageRef.current;
      if (!st) return;
      // si estamos editando texto, no hacemos zoom (opcion B: seguro)
      if (editingRef.current) return;

      const oldZoom = zoomRef.current;
      const pointer = st.getPointerPosition();
      if (!pointer) return;

      const effOld = fitScaleRef.current * oldZoom;
      // punto del "mundo" bajo el cursor antes del zoom
      const worldX = (pointer.x - panRef.current.x) / effOld;
      const worldY = (pointer.y - panRef.current.y) / effOld;

      const direction = e.deltaY > 0 ? -1 : 1;
      const factor = 1.08;
      let newZoom = direction > 0 ? oldZoom * factor : oldZoom / factor;
      newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
      zoomRef.current = newZoom;

      const effNew = fitScaleRef.current * newZoom;
      // reposiciona el pan para que el punto bajo el cursor no se mueva
      panRef.current = {
        x: pointer.x - worldX * effNew,
        y: pointer.y - worldY * effNew,
      };

      applyTransform();
      setZoomLabel(Math.round(newZoom * 100));
    };

    // pan con barra espaciadora + arrastre, o boton central
    let panning = false;
    let lastPos = { x: 0, y: 0 };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !editingRef.current) {
        spacePressedRef.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spacePressedRef.current = false;
    };

    const onMouseDown = (e: MouseEvent) => {
      const st = stageRef.current;
      // pan si: boton central, O espacio+izquierdo, O click izquierdo en zona VACIA
      // (no sobre una capa). Konva nos dice que hay bajo el puntero.
      let onEmpty = false;
      if (st && e.button === 0 && !spacePressedRef.current) {
        const target = st.getIntersection(st.getPointerPosition()!);
        // si no hay nodo, o el target es el propio Stage, es zona vacia
        onEmpty = !target || target === st;
      }
      if (e.button === 1 || (spacePressedRef.current && e.button === 0) || onEmpty) {
        panning = true;
        lastPos = { x: e.clientX, y: e.clientY };
        // cursor de "agarrar" durante el pan
        if (st) st.container().style.cursor = "grabbing";
        e.preventDefault();
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!panning) return;
      const dx = e.clientX - lastPos.x;
      const dy = e.clientY - lastPos.y;
      lastPos = { x: e.clientX, y: e.clientY };
      panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy };
      applyTransform();
    };
    const onMouseUp = () => {
      panning = false;
      const st = stageRef.current;
      if (st) st.container().style.cursor = "default";
    };

    // engancha los listeners a un stage concreto, devuelve la funcion de limpieza
    const attach = (stage: any) => {
      const container = stage.container();
      container.addEventListener("wheel", onWheel, { passive: false });
      container.addEventListener("mousedown", onMouseDown);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      applyTransform();
      return () => {
        container.removeEventListener("wheel", onWheel);
        container.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
      };
    };

    // reintenta hasta que el Stage exista (puede no estar en el primer frame)
    const trySetup = () => {
      const st = stageRef.current;
      if (!st) {
        rafId = requestAnimationFrame(trySetup);
        return;
      }
      detach = attach(st);
    };
    trySetup();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (detach) detach();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas.width, canvas.height, canvasChoice]);

  // reset de zoom al 100% (fit)
  const resetZoom = () => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    const st = stageRef.current;
    if (st) {
      const eff = fitScaleRef.current;
      st.scale({ x: eff, y: eff });
      st.position({ x: 0, y: 0 });
      st.batchDraw();
    }
    setZoomLabel(100);
  };

  // Aplica un zoom concreto (desde el slider o botones +/-),
  // manteniendo centrado el punto medio del viewport visible.
  const setZoomCentered = (newZoom: number) => {
    const ZOOM_MIN = 0.2;
    const ZOOM_MAX = 8;
    newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));

    const st = stageRef.current;
    if (!st) {
      zoomRef.current = newZoom;
      setZoomLabel(Math.round(newZoom * 100));
      return;
    }

    // centro del viewport (area visible 720x540)
    const cx = maxW / 2;
    const cy = maxH / 2;

    const oldZoom = zoomRef.current;
    const effOld = fitScaleRef.current * oldZoom;
    // punto del mundo en el centro antes del zoom
    const worldX = (cx - panRef.current.x) / effOld;
    const worldY = (cy - panRef.current.y) / effOld;

    zoomRef.current = newZoom;
    const effNew = fitScaleRef.current * newZoom;
    // recoloca el pan para que ese punto siga en el centro
    panRef.current = { x: cx - worldX * effNew, y: cy - worldY * effNew };

    st.scale({ x: effNew, y: effNew });
    st.position({ x: panRef.current.x, y: panRef.current.y });
    st.batchDraw();
    setZoomLabel(Math.round(newZoom * 100));
  };

  useEffect(() => {
    const projectId = searchParams.get("project");
    if (!projectId) return;
    // si viene un proyecto, saltamos la pantalla de nuevo proyecto
    setCanvasChoice({ mode: "free", width: 800, height: 600, label: "Proyecto" });

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/api/projects/${projectId}`);
        if (!res.ok) throw new Error("No se pudo cargar el proyecto.");
        const data = await res.json();

        const loaded: EditorLayer[] = await Promise.all(
          (data.layers || []).map(async (l: any) => ({
            ...l,
            img: l.png ? await dataUrlToImage(l.png) : null,
          }))
        );

        setCanvas({ width: data.width, height: data.height });
        setLayers(loaded);
        setPast([]);
        setFuture([]);
        setSelectedId(null);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleFile = useCallback(async (file?: File | null) => {
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
        parsed.map(async (l) => ({ ...l, img: await svgToImage(l.svg!) }))
      );

      setCanvas({ width, height });
      setLayers(withImages);
      setPast([]);
      setFuture([]);
      setSelectedId(null);
    } catch (e: any) {
      setError(e.message);
      setLayers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const addImage = useCallback(async (file?: File | null) => {
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
      const newLayer: EditorLayer = {
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
      };
      commit((prev) => [...prev, newLayer]);
      setSelectedId(id);
    } catch (e: any) {
      setError(e.message);
    }
  }, [canvas.width, canvas.height, layers.length, commit]);

  const splitByColor = async (layer: EditorLayer) => {
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
      const newLayers: EditorLayer[] = [];
      for (let i = 0; i < data.layers.length; i++) {
        const cl = data.layers[i];
        const img = await dataUrlToImage(cl.png);
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
          x: cl.x ?? 0,
          y: cl.y ?? 0,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        });
      }

      commit((prev) => {
        const idx = prev.findIndex((l) => l.id === layer.id);
        if (idx < 0) return [...prev, ...newLayers];
        const next = [...prev];
        next.splice(idx, 1, ...newLayers);
        return next;
      });
      setSelectedId(newLayers[0].id);
      setDragId(null);
      setDragOverId(null);
    } catch (e: any) {
      setError(`No se pudo separar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const isSvg = file.type === "image/svg+xml" || file.name.endsWith(".svg");
    if (isSvg) handleFile(file);
    else addImage(file);
  };

  const updateLayer = useCallback((updated: EditorLayer) =>
    setLayers((prev) => prev.map((l) => (l.id === updated.id ? updated : l))), []);

  const commitLayer = useCallback((updated: EditorLayer) =>
    commit((prev) => prev.map((l) => (l.id === updated.id ? updated : l))), [commit]);

  const toggleVisible = (id: string) =>
    commit((prev) => prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));

  const removeLayer = (id: string) => {
    commit((prev) => prev.filter((l) => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // duplica una capa con un pequeno desplazamiento, y selecciona la copia
  const duplicateLayer = (id: string) => {
    const orig = layers.find((l) => l.id === id);
    if (!orig) return;
    const copy: EditorLayer = {
      ...orig,
      id: `layer-${Date.now()}`,
      name: `${orig.name} copia`,
      x: (orig.x ?? 0) + 16,
      y: (orig.y ?? 0) + 16,
    };
    commit((prev) => {
      const i = prev.findIndex((l) => l.id === id);
      const next = [...prev];
      next.splice(i + 1, 0, copy); // inserta justo encima del original
      return next;
    });
    setSelectedId(copy.id);
  };

  // portapapeles interno (no usa el del sistema, es para capas)
  const clipboardRef = useRef<EditorLayer | null>(null);

  const copyLayer = (id: string) => {
    const l = layers.find((x) => x.id === id);
    if (l) clipboardRef.current = l;
  };

  const pasteLayer = () => {
    const src = clipboardRef.current;
    if (!src) return;
    const copy: EditorLayer = {
      ...src,
      id: `layer-${Date.now()}`,
      name: `${src.name} copia`,
      x: (src.x ?? 0) + 16,
      y: (src.y ?? 0) + 16,
    };
    commit((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  };

  // tamano renderizado de una capa (ancho/alto en px del lienzo)
  const layerSize = (l: EditorLayer): { w: number; h: number } => {
    if (l.img) {
      return {
        w: l.img.width * (l.scaleX ?? 1),
        h: l.img.height * (l.scaleY ?? 1),
      };
    }
    // texto u otros: aproximacion por fontSize (suficiente para alinear)
    const fs = l.fontSize ?? 32;
    const textLen = (l.text ?? "").length || 4;
    return { w: fs * 0.6 * textLen * (l.scaleX ?? 1), h: fs * 1.2 * (l.scaleY ?? 1) };
  };

  // alinea la capa seleccionada respecto al lienzo
  type AlignKind = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";
  const alignLayer = (kind: AlignKind) => {
    if (!selectedId) return;
    const l = layers.find((x) => x.id === selectedId);
    if (!l) return;
    const { w, h } = layerSize(l);
    const next = { ...l };
    switch (kind) {
      case "left":    next.x = 0; break;
      case "hcenter": next.x = (canvas.width - w) / 2; break;
      case "right":   next.x = canvas.width - w; break;
      case "top":     next.y = 0; break;
      case "vcenter": next.y = (canvas.height - h) / 2; break;
      case "bottom":  next.y = canvas.height - h; break;
    }
    commitLayer(next);
  };

  const moveLayer = (id: string, dir: number) => {
    commit((prev) => {
      const i = prev.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const reorderLayers = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    commit((prev) => {
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
    const newLayer: EditorLayer = {
      id,
      name: t("textLayer"),
      tag: "text",
      type: "text",
      text: t("defaultText"),
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
    commit((prev) => [...prev, newLayer]);
    setSelectedId(id);
    setTimeout(() => startEditing(newLayer), 0);
  };

  const startEditing = useCallback((layer: EditorLayer) => {
    // Opcion B: al editar texto, reseteamos zoom/pan a fit para que el
    // textarea superpuesto cuadre con coordenadas simples.
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    const st = stageRef.current;
    if (st) {
      const fit = Math.min(720 / canvas.width, 540 / canvas.height, 1);
      st.scale({ x: fit, y: fit });
      st.position({ x: 0, y: 0 });
      st.batchDraw();
    }
    setZoomLabel(100);
    const scale = Math.min(720 / canvas.width, 540 / canvas.height, 1);
    setEditing({
      id: layer.id,
      value: layer.text || "",
      style: {
        left: layer.x * scale,
        top: layer.y * scale,
        fontSize: (layer.fontSize || 48) * layer.scaleX * scale,
        color: layer.fill,
        transform: layer.rotation ? `rotate(${layer.rotation}deg)` : "none",
        transformOrigin: "left top",
      },
    });
  }, [canvas.width, canvas.height]);

  const commitEditing = () => {
    if (!editing) return;
    const value = editing.value;
    commit((prev) =>
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
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (e: any) {
      setError(`No se pudo exportar: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  const exportSvg = () => {
    if (layers.length === 0) return;

    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const parts = layers
      .filter((l) => l.visible)
      .map((l) => {
        const op = (l.opacity ?? 1) < 1 ? ` opacity="${l.opacity}"` : "";
        const tr = `translate(${l.x} ${l.y}) rotate(${l.rotation}) scale(${l.scaleX} ${l.scaleY})`;

        if (l.type === "text") {
          const lines = (l.text || "").split("\n");
          const tspans = lines
            .map((ln, i) =>
              `<tspan x="0" dy="${i === 0 ? l.fontSize : (l.fontSize || 48) * 1.3}">${esc(ln)}</tspan>`
            )
            .join("");
          return `<g transform="${tr}"${op}><text font-family="DM Sans, sans-serif" font-size="${l.fontSize}" fill="${l.fill}">${tspans}</text></g>`;
        }

        if (l.svg) {
          const inner = l.svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
          return `<g transform="${tr}"${op}>${inner}</g>`;
        }

        if (l.img) {
          const w = l.img.width;
          const h = l.img.height;
          const href = imageToDataUrl(l.img, w, h);
          return `<g transform="${tr}"${op}><image width="${w}" height="${h}" href="${href}"/></g>`;
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
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const maxW = 720;
  const maxH = 540;
  // scale base: encaja la imagen en el area visible (es el zoom 100% "fit")
  const fitScale = Math.min(maxW / canvas.width, maxH / canvas.height, 1);
  // el scale efectivo es el fit * el zoom del usuario
  const scale = fitScale * zoomRef.current;

  const hasContent = layers.length > 0;
  const editingLayer = editing ? layers.find((l) => l.id === editing.id) : null;
  const selectedLayer = layers.find((l) => l.id === selectedId);
  const canSplit = selectedLayer && selectedLayer.type === "image" && selectedLayer.file;

  // sincroniza refs espejo (para los listeners nativos de zoom/pan)
  fitScaleRef.current = fitScale;
  editingRef.current = !!editing;

  // si aun no se ha elegido lienzo (y no viene un proyecto), mostrar la
  // pantalla de nuevo proyecto antes del editor
  if (!canvasChoice) {
    return (
      <div className="ed-root">
        <style>{styles}</style>
        <NewProjectScreen onCreate={handleCreateCanvas} />
      </div>
    );
  }

  return (
    <div className="ed-root">
      <style>{styles}</style>

      <header className="ed-header">
        <div className="ed-brand">
          <Layers size={18} strokeWidth={2.5} />
          <span>{t("brand")}</span>
        </div>

        <button className="ed-icon-btn" onClick={undo} disabled={!canUndo} title={t("undo")}>
          <Undo2 size={16} />
        </button>
        <button className="ed-icon-btn" onClick={redo} disabled={!canRedo} title={t("redo")}>
          <Redo2 size={16} />
        </button>

        <button className="ed-zoom-btn" onClick={resetZoom} title="Restablecer zoom">
          {zoomLabel}%
        </button>

        <button className="ed-btn" onClick={() => fileRef.current?.click()}>
          <Upload size={15} /> {t("uploadSvg")}
        </button>
        <button className="ed-btn ed-btn-ghost" onClick={() => imgRef.current?.click()}>
          <ImagePlus size={15} /> {t("addImage")}
        </button>
        <button className="ed-btn ed-btn-ghost" onClick={addText}>
          <Type size={15} /> {t("addText")}
        </button>
        {canSplit && (
          <button className="ed-btn ed-btn-ghost" onClick={() => splitByColor(selectedLayer!)}>
            <Blend size={15} /> {t("splitColor")}
          </button>
        )}
        <button
          className="ed-btn ed-btn-ghost"
          onClick={exportSvg}
          disabled={!hasContent}
        >
          <FileCode size={15} /> {t("exportSvg")}
        </button>
        <button
          className="ed-btn ed-btn-ghost"
          onClick={exportPsd}
          disabled={!hasContent || exporting}
        >
          <Download size={15} /> {exporting ? t("exporting") : t("exportPsd")}
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
          {!hasContent && canvasMode !== "fixed" ? (
            <div className="ed-empty">
              {loading ? (
                <p>{t("processing")}</p>
              ) : (
                <>
                  <Upload size={32} strokeWidth={1.5} />
                  <p>{t("emptyTitle")}</p>
                  <span>{t("emptyHint")}</span>
                </>
              )}
              {error && <p className="ed-error">{error}</p>}
            </div>
          ) : (
            <>
              <div
                className="ed-stage-frame"
                style={{ width: maxW, height: maxH, position: "relative" }}
              >
                <Stage
                  ref={stageRef}
                  width={maxW}
                  height={maxH}
                  scaleX={scale}
                  scaleY={scale}
                >
                  <Layer>
                    {/* lienzo (papel) en modo fijo: fondo blanco del tamano elegido */}
                    {canvasMode === "fixed" && (
                      <Rect
                        x={0}
                        y={0}
                        width={canvas.width}
                        height={canvas.height}
                        fill="#ffffff"
                        listening={false}
                        shadowColor="rgba(0,0,0,0.3)"
                        shadowBlur={12}
                        shadowOpacity={0.25}
                      />
                    )}
                    {layers.map((l) => (
                      <CanvasLayer
                        key={l.id}
                        layer={l}
                        isSelected={l.id === selectedId}
                        onChange={updateLayer}
                        onCommit={commitLayer}
                        onEditText={startEditing}
                        hidden={!!editing && editing.id === l.id}
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
                      setEditing((prev) => (prev ? { ...prev, value: e.target.value } : prev))
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

              {/* Control de zoom flotante (estilo Canva) */}
              {selectedId && (
                <div className="ed-align-bar">
                  <button className="ed-align-btn" onClick={() => alignLayer("left")} title="Alinear izquierda">
                    <AlignStartVertical size={15} />
                  </button>
                  <button className="ed-align-btn" onClick={() => alignLayer("hcenter")} title="Centrar horizontal">
                    <AlignCenterVertical size={15} />
                  </button>
                  <button className="ed-align-btn" onClick={() => alignLayer("right")} title="Alinear derecha">
                    <AlignEndVertical size={15} />
                  </button>
                  <span className="ed-align-sep" />
                  <button className="ed-align-btn" onClick={() => alignLayer("top")} title="Alinear arriba">
                    <AlignStartHorizontal size={15} />
                  </button>
                  <button className="ed-align-btn" onClick={() => alignLayer("vcenter")} title="Centrar vertical">
                    <AlignCenterHorizontal size={15} />
                  </button>
                  <button className="ed-align-btn" onClick={() => alignLayer("bottom")} title="Alinear abajo">
                    <AlignEndHorizontal size={15} />
                  </button>
                </div>
              )}

              <div className="ed-zoom-bar">
                <button
                  className="ed-zoom-ctrl"
                  onClick={() => setZoomCentered(zoomRef.current / 1.2)}
                  title="Alejar"
                >
                  &minus;
                </button>
                <input
                  className="ed-zoom-slider"
                  type="range"
                  min={20}
                  max={800}
                  value={zoomLabel}
                  onChange={(e) => setZoomCentered(Number(e.target.value) / 100)}
                />
                <button
                  className="ed-zoom-ctrl"
                  onClick={() => setZoomCentered(zoomRef.current * 1.2)}
                  title="Acercar"
                >
                  +
                </button>
                <span className="ed-zoom-pct">{zoomLabel}%</span>
                <button className="ed-zoom-fit" onClick={resetZoom} title="Ajustar a pantalla">
                  Ajustar
                </button>
              </div>
            </>
          )}
        </main>

        <aside className={`ed-panel ${panelOpen ? "" : "ed-panel-collapsed"}`}>
          <button className="ed-panel-head" onClick={() => setPanelOpen((o) => !o)}>
            {panelOpen ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            <span>{t("layers")} {layers.length > 0 && `(${layers.length})`}</span>
          </button>
          {panelOpen && (
            <>
              <ul className="ed-layer-list">
                {layers.length === 0 && <li className="ed-layer-none">{t("noLayers")}</li>}
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
                    <span className="ed-grip" title={t("reorder")}>
                      <GripVertical size={14} />
                    </span>
                    <button
                      className="ed-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleVisible(l.id);
                      }}
                      title={l.visible ? t("hide") : t("show")}
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
                          commitLayer({ ...l, name: e.target.value || l.name });
                          setRenamingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            commitLayer({ ...l, name: (e.target as HTMLInputElement).value || l.name });
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
                        title={t("rename")}
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
                      title={t("moveUp")}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      className="ed-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLayer(l.id, -1);
                      }}
                      title={t("moveDown")}
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      className="ed-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateLayer(l.id);
                      }}
                      title={t("duplicate")}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      className="ed-icon ed-icon-del"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLayer(l.id);
                      }}
                      title={t("delete")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>

              <PropertiesPanel layer={selectedLayer} onChange={updateLayer} onCommit={commitLayer} t={t} />
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
  .ed-icon-btn { display:inline-flex; align-items:center; justify-content:center;
    background:transparent; color:var(--txt); border:0; box-shadow:inset 0 0 0 1px var(--line);
    width:34px; height:34px; border-radius:8px; cursor:pointer; }
  .ed-icon-btn:hover:not(:disabled) { background:#23262f; }
  .ed-icon-btn:disabled { opacity:.35; cursor:not-allowed; }
  .ed-zoom-btn { background:transparent; color:var(--muted); border:0;
    box-shadow:inset 0 0 0 1px var(--line); height:34px; padding:0 10px;
    border-radius:8px; cursor:pointer; font-size:12px; font-family:'JetBrains Mono',monospace;
    min-width:54px; }
  .ed-zoom-btn:hover { background:#23262f; color:var(--txt); }
  .ed-align-bar { position:absolute; top:16px; left:50%; transform:translateX(-50%);
    display:flex; align-items:center; gap:4px; background:var(--panel);
    border:1px solid var(--line); border-radius:10px; padding:5px 8px;
    box-shadow:0 4px 16px rgba(0,0,0,.35); z-index:5; }
  .ed-align-btn { background:transparent; border:0; color:var(--txt); cursor:pointer;
    width:30px; height:30px; border-radius:7px; display:flex; align-items:center;
    justify-content:center; }
  .ed-align-btn:hover { background:#23262f; color:var(--accent); }
  .ed-align-sep { width:1px; height:20px; background:var(--line); margin:0 3px; }
  .ed-zoom-bar { position:absolute; bottom:16px; left:50%; transform:translateX(-50%);
    display:flex; align-items:center; gap:8px; background:var(--panel);
    border:1px solid var(--line); border-radius:10px; padding:6px 10px;
    box-shadow:0 4px 16px rgba(0,0,0,.35); z-index:5; }
  .ed-zoom-ctrl { background:transparent; border:0; color:var(--txt); cursor:pointer;
    width:24px; height:24px; border-radius:6px; font-size:16px; line-height:1;
    display:flex; align-items:center; justify-content:center; }
  .ed-zoom-ctrl:hover { background:#23262f; color:var(--accent); }
  .ed-zoom-slider { width:140px; accent-color:var(--accent); cursor:pointer; }
  .ed-zoom-pct { font-size:12px; color:var(--muted); font-family:'JetBrains Mono',monospace;
    min-width:42px; text-align:right; }
  .ed-zoom-fit { background:transparent; border:0; box-shadow:inset 0 0 0 1px var(--line);
    color:var(--txt); cursor:pointer; font-size:12px; padding:4px 10px; border-radius:6px;
    font-family:inherit; }
  .ed-zoom-fit:hover { background:#23262f; color:var(--accent); }
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