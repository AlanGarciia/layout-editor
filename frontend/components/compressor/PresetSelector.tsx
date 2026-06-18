"use client";

import { Globe, Share2, Printer } from "lucide-react";

const PRESETS = [
  { id: "web", label: "Web", desc: "max 1920px, WebP, calidad 78", icon: Globe },
  { id: "social", label: "Redes", desc: "max 1080px, JPG, calidad 82", icon: Share2 },
  { id: "print", label: "Impresion", desc: "tamano original, calidad 88", icon: Printer },
];

export default function PresetSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="cp-presets">
      {PRESETS.map((p) => {
        const Icon = p.icon;
        return (
          <button
            key={p.id}
            className={`cp-preset ${value === p.id ? "cp-preset-sel" : ""}`}
            onClick={() => onChange(p.id)}
          >
            <Icon size={20} strokeWidth={2} />
            <span className="cp-preset-label">{p.label}</span>
            <span className="cp-preset-desc">{p.desc}</span>
          </button>
        );
      })}
    </div>
  );
}

export { PRESETS };