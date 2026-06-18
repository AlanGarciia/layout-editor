"use client";

import dynamic from "next/dynamic";

// Konva necesita el navegador. Cargamos el editor solo en cliente (ssr: false).
const LayerEditor = dynamic(() => import("@/components/editor/LayerEditor"), {
  ssr: false,
  loading: () => <p style={{ padding: 24 }}>Cargando editor...</p>,
});

export default function EditorPage() {
  return <LayerEditor />;
}