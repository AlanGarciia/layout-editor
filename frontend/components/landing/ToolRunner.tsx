"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ToolConfig } from "@/lib/tools.config";
import { runPlugin } from "@/lib/api";

/*
 * ToolRunner (cliente)
 * --------------------
 * Demo generica para cualquier landing. Sube un archivo, llama al plugin de la
 * config y muestra el resultado segun tool.outputKind.
 *
 * Para "layers": ofrece "Editar en el editor", que guarda las capas como un
 * proyecto temporal en el backend y navega a /app/editor?project={id}.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ColorLayer {
  name: string;
  hex: string;
  png: string;
  pixels: number;
}

interface LayersResult {
  width: number;
  height: number;
  layers: ColorLayer[];
}

export default function ToolRunner({ tool }: { tool: ToolConfig }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LayersResult | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setResult(null);
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
    reset();
    try {
      const res = await runPlugin(tool.plugin, file);
      if (tool.outputKind === "layers") {
        setResult(res.data as LayersResult);
      } else if (res.blob) {
        setDownloadUrl(URL.createObjectURL(res.blob));
      } else {
        throw new Error("El plugin no devolvio un resultado valido.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  };

  // Convierte las capas del plugin al formato del editor y las guarda como
  // proyecto temporal en el backend; luego navega al editor con el id.
  const editInEditor = async () => {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      const stamp = Date.now();
      const editorLayers = result.layers.map((cl, i) => ({
        id: `layer-color-${stamp}-${i}`,
        name: cl.name,
        tag: "color",
        type: "image",
        svg: null,
        png: cl.png, // el editor cargara el HTMLImageElement desde este dataURL
        file: null,
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      }));

      const res = await fetch(`${API_URL}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          width: result.width,
          height: result.height,
          layers: editorLayers,
        }),
      });
      if (!res.ok) throw new Error("No se pudo guardar el proyecto.");
      const { id } = await res.json();
      router.push(`/app/editor?project=${id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al abrir el editor");
      setSaving(false);
    }
  };

  return (
    <div className="tr-root">
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

      {downloadUrl && (
        <a className="tr-download" href={downloadUrl} download={`${tool.slug}-resultado`}>
          Descargar resultado
        </a>
      )}

      {result && (
        <div className="tr-layers">
          <p className="tr-layers-title">{result.layers.length} capas detectadas</p>
          <div className="tr-layers-grid">
            {result.layers.map((l, i) => (
              <div className="tr-layer" key={i}>
                <div className="tr-swatch" style={{ backgroundImage: `url(${l.png})` }} />
                <span className="tr-hex">{l.hex}</span>
              </div>
            ))}
          </div>
          <button className="tr-cta-editor" onClick={editInEditor} disabled={saving}>
            {saving ? "Abriendo editor..." : "Editar estas capas en el editor ->"}
          </button>
        </div>
      )}

      <style>{styles}</style>
    </div>
  );
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
  .tr-layers-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(72px,1fr)); gap:10px; }
  .tr-layer { display:flex; flex-direction:column; align-items:center; gap:4px; }
  .tr-swatch { width:100%; aspect-ratio:1; border-radius:8px; border:1px solid var(--line);
    background-size:contain; background-repeat:no-repeat; background-position:center;
    background-color:#0f1116; }
  .tr-hex { font-size:11px; color:var(--muted); font-family:monospace; }
  .tr-cta-editor { display:inline-block; margin-top:18px; color:var(--accent);
    font-weight:600; background:transparent; border:0; cursor:pointer; font-family:inherit;
    font-size:15px; padding:0; text-align:left; }
  .tr-cta-editor:disabled { opacity:.5; cursor:not-allowed; }
`;