"use client";

import dynamic from "next/dynamic";

// El compressor es de cliente (sube archivos, usa SVGO en navegador).
const Compressor = dynamic(() => import("@/components/compressor/Compressor"), {
  ssr: false,
  loading: () => <p style={{ padding: 24 }}>Cargando...</p>,
});

export default function OptimizerPage() {
  return <Compressor />;
}