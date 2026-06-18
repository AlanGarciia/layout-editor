"use client";

import { useState, useRef } from "react";
import type { ToolConfig } from "@/lib/tools.config";

/*
 * ToolRunner (cliente)
 * --------------------
 * Demo sin registro que aparece en cada landing. Sube un archivo, lo manda al
 * backend (endpoints actuales) y muestra el resultado segun el tipo de tool:
 *
 *   outputKind "download" -> descarga el archivo resultante (p. ej. PSD)
 *   outputKind "layers"   -> muestra las capas devueltas como miniaturas
 *   outputKind "image"    -> muestra la imagen resultante
 *
 * Nota: por ahora llama a los endpoints viejos (/layers/split-color, /export/psd).
 * Cuando migremos a plugins, solo cambia la URL aqui dentro.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ColorLayer {
  name: string;
  hex: string;
  png: string;
  pixels: number;
}

export default function ToolRunner({ tool }: { tool: ToolConfig }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layers, setLayers] = useState<ColorLayer[] | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setLayers(null);
    setDownloadUrl(null);
    setError(null);
  };

  const onPick = (f?: File | null) => {
    if (!f) return;
    reset();
    setFile(f);
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setLayers(null);
    setDownloadUrl(null);

    try {
      if (tool.plugin === "image_to_layers") {
        // separar por color -> devuelve JSON con capas
        const form = new FormData();
        form.append("file", file);
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
        setLayers(data.layers || []);
      } else if (tool.plugin === "psd_export") {
        // convertir a PSD: el backend actual espera capas rasterizadas en JSON.
        // Para una demo simple desde un PNG plano, mandamos la imagen como una
        // unica capa. (Cuando migremos a plugins, el plugin psd_export aceptara
        // el archivo directamente.)
        const img = await loadImage(file);
        const png = await fileToPngDataUrl(img);
        const payload = {
          width: img.width,
          height: img.height,
          layers: [{ name: file.name, png, x: 0, y: 0, visible: true }],
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
        setDownloadUrl(URL.createObjectURL(blob));
      } else {
        throw new Error("Esta herramienta aun no esta conectada.");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tr-root">
      {/* Zona de subida */}
      <div
        className="tr-drop"
        onClick={() => inputRef.current?.click()}
        onDrop={(e) => {
          e.preventDefault();
          onPick(e.dataTransfer.files?.[0]);
        }}
        onDragOver={(e) => e.preventDefault()}
      >
        {file ? (
          <p className="tr-filename">{file.name}</p>
        ) : (
          <>
            <p>Arrastra tu archivo aqui o haz clic</p>
            <span>{tool.accept.replace(/image\/\*/g, "imagenes")}</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={tool.accept}
          hidden
          onChange={(e) => onPick(e.target.files?.[0])}
        />
      </div>

      <button className="tr-btn" onClick={run} disabled={!file || busy}>
        {busy ? "Procesando..." : "Procesar"}
      </button>

      {error && <p className="tr-error">{error}</p>}

      {/* Resultado: descarga */}
      {downloadUrl && (
        <a className="tr-download" href={downloadUrl} download="resultado.psd">
          Descargar resultado
        </a>
      )}

      {/* Resultado: capas */}
      {layers && (
        <div className="tr-layers">
          <p className="tr-layers-title">{layers.length} capas detectadas</p>
          <div className="tr-layers-grid">
            {layers.map((l, i) => (
              <div className="tr-layer" key={i}>
                <div
                  className="tr-swatch"
                  style={{ backgroundImage: `url(${l.png})` }}
                />
                <span className="tr-hex">{l.hex}</span>
              </div>
            ))}
          </div>
          <a className="tr-cta-editor" href="/app/editor">
            Editar estas capas en el editor -&gt;
          </a>
        </div>
      )}

      <style>{styles}</style>
    </div>
  );
}

// --- helpers ---

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => reject(new Error("No se pudo leer la imagen."));
    img.src = url;
  });
}

function fileToPngDataUrl(img: HTMLImageElement): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  return Promise.resolve(canvas.toDataURL("image/png"));
}

const styles = `
  .tr-root { --panel:#1d2027; --line:#2a2e38; --txt:#e6e8ec; --muted:#8b90a0;
    --accent:#4d9d84; --danger:#ef7766;
    max-width:560px; margin:32px auto 0; display:flex; flex-direction:column; gap:14px; }
  .tr-drop { border:2px dashed var(--line); border-radius:12px; padding:36px 20px;
    text-align:center; cursor:pointer; background:var(--panel); color:var(--muted);
    transition:border-color .15s; }
  .tr-drop:hover { border-color:var(--accent); }
  .tr-drop p { margin:0; color:var(--txt); font-weight:500; }
  .tr-drop span { font-size:13px; }
  .tr-filename { color:var(--accent)!important; font-weight:600!important; }
  .tr-btn { background:var(--accent); color:#0c0d10; border:0; padding:12px;
    border-radius:10px; font-weight:600; font-size:15px; cursor:pointer; font-family:inherit; }
  .tr-btn:hover:not(:disabled) { filter:brightness(1.08); }
  .tr-btn:disabled { opacity:.45; cursor:not-allowed; }
  .tr-error { color:var(--danger); font-size:14px; margin:0; }
  .tr-download { background:transparent; color:var(--txt); text-align:center;
    padding:12px; border-radius:10px; box-shadow:inset 0 0 0 1px var(--accent);
    text-decoration:none; font-weight:600; }
  .tr-download:hover { background:rgba(77,157,132,.12); }
  .tr-layers { margin-top:8px; }
  .tr-layers-title { color:var(--muted); font-size:14px; margin:0 0 12px; }
  .tr-layers-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(72px,1fr));
    gap:10px; }
  .tr-layer { display:flex; flex-direction:column; align-items:center; gap:4px; }
  .tr-swatch { width:100%; aspect-ratio:1; border-radius:8px; border:1px solid var(--line);
    background-size:contain; background-repeat:no-repeat; background-position:center;
    background-color:#0f1116;
    background-image:
      linear-gradient(45deg,#222 25%,transparent 25%),
      linear-gradient(-45deg,#222 25%,transparent 25%),
      linear-gradient(45deg,transparent 75%,#222 75%),
      linear-gradient(-45deg,transparent 75%,#222 75%); }
  .tr-hex { font-size:11px; color:var(--muted); font-family:monospace; }
  .tr-cta-editor { display:inline-block; margin-top:18px; color:var(--accent);
    font-weight:600; text-decoration:none; }
`;