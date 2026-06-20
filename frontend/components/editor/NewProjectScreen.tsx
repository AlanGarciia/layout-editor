"use client";

import { useState } from "react";
import { LayoutGrid, Smartphone, FileText, Square, Maximize, Plus } from "lucide-react";

/*
 * Pantalla de "nuevo proyecto": elige el lienzo antes de entrar al editor.
 * - Presets de tamano fijo (Instagram, A4, etc.)
 * - Tamano personalizado (ancho x alto)
 * - Lienzo libre (sin bordes fijos, como el modo clasico)
 *
 * Al elegir, llama onCreate con el lienzo elegido.
 */

export type CanvasMode = "fixed" | "free";

export interface CanvasChoice {
  mode: CanvasMode;
  width: number;
  height: number;
  label: string;
}

interface Preset {
  key: string;
  label: string;
  width: number;
  height: number;
  icon: React.ReactNode;
}

const PRESETS: Preset[] = [
  { key: "ig-post", label: "Instagram post", width: 1080, height: 1080, icon: <Square size={20} /> },
  { key: "ig-story", label: "Instagram historia", width: 1080, height: 1920, icon: <Smartphone size={20} /> },
  { key: "fb-post", label: "Facebook post", width: 1200, height: 630, icon: <LayoutGrid size={20} /> },
  { key: "a4", label: "A4 (150 dpi)", width: 1240, height: 1754, icon: <FileText size={20} /> },
];

export default function NewProjectScreen({
  onCreate,
}: {
  onCreate: (choice: CanvasChoice) => void;
}) {
  const [customW, setCustomW] = useState(1000);
  const [customH, setCustomH] = useState(1000);

  return (
    <div className="np-root">
      <div className="np-box">
        <h1 className="np-title">Nuevo proyecto</h1>
        <p className="np-sub">Elige el tamano del lienzo para empezar.</p>

        <div className="np-section">Tamanos predefinidos</div>
        <div className="np-grid">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              className="np-card"
              onClick={() =>
                onCreate({ mode: "fixed", width: p.width, height: p.height, label: p.label })
              }
            >
              <span className="np-card-icon">{p.icon}</span>
              <span className="np-card-label">{p.label}</span>
              <span className="np-card-dim">{p.width} x {p.height}</span>
            </button>
          ))}
        </div>

        <div className="np-section">Personalizado</div>
        <div className="np-custom">
          <div className="np-custom-fields">
            <label>
              <span>Ancho</span>
              <input
                type="number"
                min={1}
                value={customW}
                onChange={(e) => setCustomW(Math.max(1, Number(e.target.value)))}
              />
            </label>
            <span className="np-custom-x">x</span>
            <label>
              <span>Alto</span>
              <input
                type="number"
                min={1}
                value={customH}
                onChange={(e) => setCustomH(Math.max(1, Number(e.target.value)))}
              />
            </label>
            <button
              className="np-custom-btn"
              onClick={() =>
                onCreate({ mode: "fixed", width: customW, height: customH, label: "Personalizado" })
              }
            >
              <Plus size={16} /> Crear
            </button>
          </div>
        </div>

        <div className="np-section">Otros</div>
        <button
          className="np-free"
          onClick={() => onCreate({ mode: "free", width: 800, height: 600, label: "Lienzo libre" })}
        >
          <Maximize size={18} />
          <span>
            <strong>Lienzo libre</strong>
            <small>Sin bordes fijos. El contenido define el espacio.</small>
          </span>
        </button>
      </div>

      <style>{styles}</style>
    </div>
  );
}

const styles = `
  .np-root { display:flex; align-items:center; justify-content:center;
    min-height:100%; padding:32px; width:100%; }
  .np-box { width:100%; max-width:640px; background:var(--panel,#1d2027);
    border:1px solid var(--line,#2a2e38); border-radius:16px; padding:28px; }
  .np-title { margin:0 0 4px; font-size:22px; color:var(--txt,#e6e8ec); }
  .np-sub { margin:0 0 20px; color:var(--muted,#8b90a0); font-size:14px; }
  .np-section { font-size:12px; text-transform:uppercase; letter-spacing:.04em;
    color:var(--muted,#8b90a0); margin:18px 0 10px; font-weight:600; }
  .np-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:10px; }
  .np-card { display:flex; flex-direction:column; align-items:flex-start; gap:6px;
    background:#15171c; border:1px solid var(--line,#2a2e38); border-radius:10px;
    padding:14px; cursor:pointer; color:var(--txt,#e6e8ec); text-align:left;
    transition:border-color .15s, transform .1s; }
  .np-card:hover { border-color:var(--accent,#4d9d84); transform:translateY(-1px); }
  .np-card-icon { color:var(--accent,#4d9d84); }
  .np-card-label { font-weight:600; font-size:14px; }
  .np-card-dim { font-size:12px; color:var(--muted,#8b90a0); font-family:monospace; }
  .np-custom { background:#15171c; border:1px solid var(--line,#2a2e38);
    border-radius:10px; padding:14px; }
  .np-custom-fields { display:flex; align-items:flex-end; gap:10px; flex-wrap:wrap; }
  .np-custom-fields label { display:flex; flex-direction:column; gap:4px;
    font-size:12px; color:var(--muted,#8b90a0); }
  .np-custom-fields input { width:100px; background:#0f1116; border:1px solid var(--line,#2a2e38);
    border-radius:7px; padding:8px 10px; color:var(--txt,#e6e8ec); font-size:14px; }
  .np-custom-x { color:var(--muted,#8b90a0); padding-bottom:9px; }
  .np-custom-btn { display:flex; align-items:center; gap:5px; background:var(--accent,#4d9d84);
    color:#0c0d10; border:0; border-radius:8px; padding:9px 14px; font-weight:600;
    cursor:pointer; font-size:14px; margin-left:auto; }
  .np-custom-btn:hover { filter:brightness(1.08); }
  .np-free { display:flex; align-items:center; gap:12px; width:100%;
    background:#15171c; border:1px solid var(--line,#2a2e38); border-radius:10px;
    padding:14px; cursor:pointer; color:var(--txt,#e6e8ec); text-align:left;
    transition:border-color .15s; }
  .np-free:hover { border-color:var(--accent,#4d9d84); }
  .np-free svg { color:var(--accent,#4d9d84); flex-shrink:0; }
  .np-free span { display:flex; flex-direction:column; gap:2px; }
  .np-free strong { font-size:14px; }
  .np-free small { font-size:12px; color:var(--muted,#8b90a0); }
`;