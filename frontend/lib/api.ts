// Cliente del backend. Un unico punto para llamar a cualquier plugin.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface RunResult {
  data?: unknown;
  blob?: Blob;
  contentType: string;
}

export async function runPlugin(
  pluginName: string,
  file: File,
  params: Record<string, unknown> = {}
): Promise<RunResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("params", JSON.stringify(params));

  const res = await fetch(`${API_URL}/api/plugins/${pluginName}/run`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    let detail = `Error ${res.status}`;
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch {
      // respuesta no-JSON
    }
    throw new Error(detail);
  }

  const contentType = res.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    return { data: await res.json(), contentType };
  }
  return { blob: await res.blob(), contentType };
}