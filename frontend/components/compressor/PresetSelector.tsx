"use client";

import { Globe, Share2, Printer } from "lucide-react";

const PRESETS = [
  { id: "web", labelKey: "presetWeb", descKey: "presetWebDesc", icon: Globe },
  { id: "social", labelKey: "presetSocial", descKey: "presetSocialDesc", icon: Share2 },
  { id: "print", labelKey: "presetPrint", descKey: "presetPrintDesc", icon: Printer },
];

export default function PresetSelector({
  value,
  onChange,
  t,
}: {
  value: string;
  onChange: (v: string) => void;
  t: (k: string) => string;
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
            <span className="cp-preset-label">{t(p.labelKey)}</span>
            <span className="cp-preset-desc">{t(p.descKey)}</span>
          </button>
        );
      })}
    </div>
  );
}

export { PRESETS };