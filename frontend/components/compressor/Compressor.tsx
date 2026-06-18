"use client";

import { useState, useCallback } from "react";
import { Sparkles, Play, Trash2, DownloadCloud } from "lucide-react";
import DropZone from "./DropZone";
import FileCard, { formatSize, type FileItem } from "./FileCard";
import PresetSelector from "./PresetSelector";
import { optimizeImage } from "./api";

/*
 * Compressor / Optimizer (Next, cliente).
 * PNG/JPG/WebP -> backend (Pillow + pngquant). SVG -> SVGO en el navegador.
 */

const SVGO_CONFIG = {
  multipass: true,
  plugins: [
    {
      name: "preset-default" as const,
      params: { overrides: { removeViewBox: false } },
    },
  ],
};

let idSeq = 0;

export default function Compressor() {
  const [items, setItems] = useState<FileItem[]>([]);
  const [preset, setPreset] = useState("web");
  const [processing, setProcessing] = useState(false);

  const addFiles = useCallback((files: File[]) => {
    const newItems: FileItem[] = files.map((file) => ({
      id: `f-${++idSeq}`,
      file,
      status: "pending",
      originalSize: file.size,
      newSize: 0,
      resultBlob: null,
      outName: null,
      error: null,
    }));
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  const processItem = async (item: FileItem) => {
    const isSvg = item.file.name.toLowerCase().endsWith(".svg");

    if (isSvg) {
      const text = await item.file.text();
      const result = svgoOptimize(text, SVGO_CONFIG);
      const optimized = result.data;
      const blob = new Blob([optimized], { type: "image/svg+xml" });
      const base = item.file.name.replace(/\.svg$/i, "");
      return {
        resultBlob: blob,
        originalSize: item.file.size,
        newSize: blob.size,
        outName: `${base}-${preset}.svg`,
      };
    }

    const { blob, originalSize, newSize, outName } = await optimizeImage(item.file, preset);
    return { resultBlob: blob, originalSize, newSize, outName };
  };

  const runAll = async () => {
    setProcessing(true);
    const pending = items.filter((i) => i.status === "pending");

    for (const target of pending) {
      setItems((prev) =>
        prev.map((i) => (i.id === target.id ? { ...i, status: "working" } : i))
      );
      try {
        const out = await processItem(target);
        setItems((prev) =>
          prev.map((i) => (i.id === target.id ? { ...i, status: "done", ...out } : i))
        );
      } catch (e: any) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === target.id ? { ...i, status: "error", error: e.message } : i
          )
        );
      }
    }
    setProcessing(false);
  };

  const download = (item: FileItem) => {
    if (!item.resultBlob) return;
    const url = URL.createObjectURL(item.resultBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.outName || "resultado";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    items.filter((i) => i.status === "done").forEach(download);
  };

  const clearAll = () => setItems([]);

  const hasItems = items.length > 0;
  const pendingCount = items.filter((i) => i.status === "pending").length;
  const doneCount = items.filter((i) => i.status === "done").length;

  const totalOrig = items.filter((i) => i.status === "done").reduce((s, i) => s + i.originalSize, 0);
  const totalNew = items.filter((i) => i.status === "done").reduce((s, i) => s + i.newSize, 0);
  const totalSaving = totalOrig > 0 ? Math.round((1 - totalNew / totalOrig) * 100) : 0;

  return (
    <div className="cp-root">
      <style>{styles}</style>

      <div className="cp-head">
        <Sparkles size={18} strokeWidth={2.5} />
        <h2>Design Compressor + Optimizer</h2>
      </div>

      <p className="cp-intro">
        Sube imagenes o SVG y obten versiones optimizadas para web, redes o impresion.
      </p>

      <PresetSelector value={preset} onChange={setPreset} />
      <DropZone onFiles={addFiles} />

      {hasItems && (
        <>
          <div className="cp-toolbar">
            <button className="cp-btn" onClick={runAll} disabled={processing || pendingCount === 0}>
              <Play size={15} />
              {processing ? "Procesando..." : `Optimizar ${pendingCount > 0 ? `(${pendingCount})` : "todo"}`}
            </button>
            <button className="cp-btn cp-btn-ghost" onClick={downloadAll} disabled={doneCount === 0}>
              <DownloadCloud size={15} /> Descargar todo ({doneCount})
            </button>
            <button className="cp-btn cp-btn-ghost cp-btn-danger" onClick={clearAll}>
              <Trash2 size={15} /> Limpiar
            </button>
            {doneCount > 0 && totalSaving > 0 && (
              <span className="cp-total">
                Ahorro total: <strong>-{totalSaving}%</strong> ({formatSize(totalOrig)} -&gt; {formatSize(totalNew)})
              </span>
            )}
          </div>

          <div className="cp-list">
            {items.map((item) => (
              <FileCard key={item.id} item={item} onDownload={download} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const styles = `
  .cp-root { --panel:#1d2027; --line:#2a2e38; --txt:#e6e8ec; --muted:#8b90a0;
    --accent:#4d9d84; --sel:#2a3a35; --danger:#ef7766;
    font-family:'DM Sans',system-ui,sans-serif; color:var(--txt);
    max-width:900px; margin:0 auto; padding:32px 24px; }
  .cp-head { display:flex; align-items:center; gap:8px; color:var(--accent); margin-bottom:4px; }
  .cp-head h2 { margin:0; font-size:18px; color:var(--txt); font-weight:600; letter-spacing:-.01em; }
  .cp-intro { color:var(--muted); margin:0 0 18px; font-size:14px; }
  .cp-presets { display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
  .cp-preset { flex:1; min-width:150px; display:flex; flex-direction:column; align-items:flex-start;
    gap:4px; padding:14px; border-radius:10px; background:var(--panel); border:1px solid var(--line);
    color:var(--txt); cursor:pointer; text-align:left; }
  .cp-preset:hover { border-color:var(--muted); }
  .cp-preset-sel { border-color:var(--accent); box-shadow:inset 0 0 0 1px var(--accent); background:var(--sel); }
  .cp-preset svg { color:var(--accent); }
  .cp-preset-label { font-weight:600; font-size:14px; }
  .cp-preset-desc { font-size:12px; color:var(--muted); }
  .cp-drop { display:flex; flex-direction:column; align-items:center; gap:6px; padding:36px;
    border:2px dashed var(--line); border-radius:12px; background:var(--panel); color:var(--muted);
    cursor:pointer; text-align:center; transition:border-color .15s; }
  .cp-drop:hover { border-color:var(--accent); }
  .cp-drop svg { color:var(--accent); }
  .cp-drop p { margin:4px 0 0; color:var(--txt); font-weight:500; }
  .cp-drop span { font-size:13px; }
  .cp-toolbar { display:flex; align-items:center; gap:10px; margin:18px 0 12px; flex-wrap:wrap; }
  .cp-btn { display:inline-flex; align-items:center; gap:7px; background:var(--accent); color:#0c0d10;
    border:0; padding:9px 15px; border-radius:8px; font-weight:600; font-size:13px; cursor:pointer; font-family:inherit; }
  .cp-btn:hover:not(:disabled) { filter:brightness(1.08); }
  .cp-btn:disabled { opacity:.45; cursor:not-allowed; }
  .cp-btn-ghost { background:transparent; color:var(--txt); box-shadow:inset 0 0 0 1px var(--line); }
  .cp-btn-ghost:hover:not(:disabled) { background:#23262f; filter:none; }
  .cp-btn-danger:hover:not(:disabled) { box-shadow:inset 0 0 0 1px var(--danger); color:var(--danger); }
  .cp-total { margin-left:auto; font-size:13px; color:var(--muted); }
  .cp-total strong { color:var(--accent); }
  .cp-list { display:flex; flex-direction:column; gap:8px; }
  .cp-card { display:flex; align-items:center; gap:12px; padding:12px 14px; background:var(--panel);
    border:1px solid var(--line); border-radius:10px; }
  .cp-card-icon { color:var(--muted); display:flex; flex-shrink:0; }
  .cp-card-body { flex:1; min-width:0; }
  .cp-card-name { font-size:14px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .cp-card-meta { font-size:12.5px; color:var(--muted); margin-top:2px; display:flex; align-items:center; gap:6px; }
  .cp-saving { font-weight:600; }
  .cp-saving-good { color:var(--accent); }
  .cp-saving-none { color:var(--muted); }
  .cp-working { color:var(--accent); }
  .cp-error-text { color:var(--danger); }
  .cp-card-action { display:flex; align-items:center; gap:8px; flex-shrink:0; }
  .cp-check { color:var(--accent); }
  .cp-dl { background:transparent; border:0; color:var(--txt); cursor:pointer; display:flex; padding:6px; border-radius:6px; }
  .cp-dl:hover { background:#23262f; color:var(--accent); }
  .cp-spin { animation:cp-rotate 1s linear infinite; }
  @keyframes cp-rotate { to { transform:rotate(360deg); } }
`;