"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const LayerEditor = dynamic(() => import("@/components/editor/LayerEditor"), {
  ssr: false,
  loading: () => <p style={{ padding: 24 }}>Cargando editor...</p>,
});

export default function EditorPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Cargando editor...</p>}>
      <LayerEditor />
    </Suspense>
  );
}