// Llamadas al backend para la fase 2 (compresion/optimizacion).
// El SVG se optimiza en el frontend (ver svgo en Compressor.jsx),
// asi que aqui solo estan las llamadas para imagenes raster.

const API_URL = "http://localhost:8000";

// Obtiene la lista de presets y si pngquant esta disponible en el servidor.
export async function fetchPresets() {
  const res = await fetch(`${API_URL}/optimize/presets`);
  if (!res.ok) throw new Error("No se pudieron cargar los presets.");
  return res.json();
}

// Envia una imagen raster al backend para optimizarla.
// Devuelve { blob, originalSize, newSize, outName }.
export async function optimizeImage(file, preset) {
  const form = new FormData();
  form.append("file", file);
  form.append("preset", preset);

  const res = await fetch(`${API_URL}/optimize/image`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error ${res.status}`);
  }

  const blob = await res.blob();
  const originalSize = Number(res.headers.get("X-Original-Size")) || file.size;
  const newSize = Number(res.headers.get("X-New-Size")) || blob.size;
  const outName = res.headers.get("X-Output-Name") || `${file.name}-${preset}`;

  return { blob, originalSize, newSize, outName };
}
