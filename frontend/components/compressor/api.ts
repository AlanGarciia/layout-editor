// Cliente del backend para el Optimizer (endpoints actuales).
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface OptimizeResult {
  blob: Blob;
  originalSize: number;
  newSize: number;
  outName: string;
}

export async function optimizeImage(file: File, preset: string): Promise<OptimizeResult> {
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