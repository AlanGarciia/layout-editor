import { useRef } from "react";
import { UploadCloud } from "lucide-react";

/*
 * DropZone
 * --------
 * Zona de subida de archivos. Acepta arrastrar-soltar o clic para abrir
 * el selector. Admite varios archivos a la vez.
 * Formatos: PNG, JPG, WebP y SVG.
 */

const ACCEPT = ".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml";

export default function DropZone({ onFiles }) {
  const inputRef = useRef();

  const handleFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length) onFiles(files);
  };

  return (
    <div
      className="cp-drop"
      onClick={() => inputRef.current?.click()}
      onDrop={(e) => {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
      }}
      onDragOver={(e) => e.preventDefault()}
    >
      <UploadCloud size={36} strokeWidth={1.5} />
      <p>Arrastra imagenes aqui o haz clic para elegir</p>
      <span>PNG, JPG, WebP y SVG. Puedes subir varias a la vez.</span>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
