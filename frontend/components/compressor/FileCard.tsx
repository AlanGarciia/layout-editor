"use client";

import { FileImage, FileCode, Download, Loader2, CheckCircle2, XCircle } from "lucide-react";

export interface FileItem {
  id: string;
  file: File;
  status: "pending" | "working" | "done" | "error";
  originalSize: number;
  newSize: number;
  resultBlob: Blob | null;
  outName: string | null;
  error: string | null;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function FileCard({
  item,
  onDownload,
}: {
  item: FileItem;
  onDownload: (item: FileItem) => void;
}) {
  const isSvg = item.file.name.toLowerCase().endsWith(".svg");
  const TypeIcon = isSvg ? FileCode : FileImage;

  const saving =
    item.status === "done" && item.originalSize > 0
      ? Math.max(0, Math.round((1 - item.newSize / item.originalSize) * 100))
      : null;

  return (
    <div className="cp-card">
      <div className="cp-card-icon">
        <TypeIcon size={22} strokeWidth={1.8} />
      </div>

      <div className="cp-card-body">
        <div className="cp-card-name">{item.file.name}</div>

        {item.status === "pending" && (
          <div className="cp-card-meta">En cola - {formatSize(item.file.size)}</div>
        )}
        {item.status === "working" && (
          <div className="cp-card-meta cp-working">
            <Loader2 size={13} className="cp-spin" /> Optimizando...
          </div>
        )}
        {item.status === "done" && (
          <div className="cp-card-meta">
            {formatSize(item.originalSize)} -&gt; {formatSize(item.newSize)}
            {saving !== null && (
              <span className={`cp-saving ${saving > 0 ? "cp-saving-good" : "cp-saving-none"}`}>
                {saving > 0 ? `-${saving}%` : "sin cambio"}
              </span>
            )}
          </div>
        )}
        {item.status === "error" && (
          <div className="cp-card-meta cp-error-text">
            <XCircle size={13} /> {item.error}
          </div>
        )}
      </div>

      <div className="cp-card-action">
        {item.status === "done" && (
          <>
            <CheckCircle2 size={16} className="cp-check" />
            <button className="cp-dl" onClick={() => onDownload(item)} title="Descargar">
              <Download size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}