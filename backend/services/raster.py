"""
Servicio de compresion de imagenes raster (PNG / JPG / WebP).
-------------------------------------------------------------
Usa Pillow para recomprimir y redimensionar. Si pngquant esta instalado
en el sistema, lo usa para comprimir PNG de forma mas agresiva; si no,
cae limpiamente a la compresion de Pillow.

Cada "preset" define tamano maximo, calidad y formato de salida.
"""

import io
import shutil
import subprocess
from dataclasses import dataclass
from typing import Optional

from PIL import Image

# ¿Esta pngquant disponible en el PATH? Se calcula una sola vez.
PNGQUANT = shutil.which("pngquant")


@dataclass
class Preset:
    name: str
    max_size: Optional[int]   # lado mayor en px (None = no redimensionar)
    quality: int              # 1-100 (JPG/WebP)
    fmt: str                  # "png" | "jpeg" | "webp" | "keep"


# Presets disponibles. "keep" conserva el formato original de la imagen.
PRESETS = {
    "web": Preset("web", max_size=1920, quality=78, fmt="webp"),
    "social": Preset("social", max_size=1080, quality=82, fmt="jpeg"),
    "print": Preset("print", max_size=None, quality=88, fmt="keep"),
}


def _resize(img: Image.Image, max_size: Optional[int]) -> Image.Image:
    """Redimensiona manteniendo proporcion si excede max_size."""
    if not max_size:
        return img
    w, h = img.size
    longest = max(w, h)
    if longest <= max_size:
        return img
    ratio = max_size / longest
    return img.resize((round(w * ratio), round(h * ratio)), Image.LANCZOS)


def _pngquant(png_bytes: bytes, quality: int) -> bytes:
    """Comprime un PNG con pngquant. Devuelve el original si algo falla."""
    if not PNGQUANT:
        return png_bytes
    # pngquant usa un rango de calidad; mapeamos a algo razonable
    qmin = max(0, quality - 20)
    try:
        proc = subprocess.run(
            [PNGQUANT, f"--quality={qmin}-{quality}", "--force", "--output", "-", "-"],
            input=png_bytes,
            capture_output=True,
            timeout=30,
        )
        if proc.returncode == 0 and proc.stdout:
            return proc.stdout
    except Exception:
        pass
    return png_bytes


def _original_meta(raw: bytes, img: Image.Image) -> tuple[str, str]:
    """Extension y mime del archivo original, para poder devolverlo tal cual."""
    fmt = (img.format or "png").lower()
    if fmt in ("jpeg", "jpg"):
        return "jpg", "image/jpeg"
    if fmt == "webp":
        return "webp", "image/webp"
    return "png", "image/png"


def optimize_image(raw: bytes, preset_name: str) -> tuple[bytes, str, str]:
    """
    Optimiza una imagen segun el preset.
    Devuelve (bytes_resultado, extension, mime_type).

    Garantia: si la version optimizada pesa MAS que el original, se devuelve
    el original sin tocar. Asi nunca empeoramos el archivo.
    """
    preset = PRESETS.get(preset_name)
    if preset is None:
        raise ValueError(f"Preset desconocido: {preset_name}")

    img = Image.open(io.BytesIO(raw))
    orig_ext, orig_mime = _original_meta(raw, img)

    # Decide el formato de salida
    fmt = preset.fmt
    if fmt == "keep":
        fmt = (img.format or "png").lower()
        if fmt == "jpg":
            fmt = "jpeg"

    work = _resize(img, preset.max_size)
    resized = work.size != img.size  # ¿hemos reducido dimensiones?

    out = io.BytesIO()

    if fmt == "jpeg":
        if work.mode in ("RGBA", "P", "LA"):
            bg = Image.new("RGB", work.size, (255, 255, 255))
            rgba = work.convert("RGBA")
            bg.paste(rgba, mask=rgba.split()[-1])
            work = bg
        else:
            work = work.convert("RGB")
        work.save(out, format="JPEG", quality=preset.quality, optimize=True, progressive=True)
        candidate, ext, mime = out.getvalue(), "jpg", "image/jpeg"

    elif fmt == "webp":
        work.save(out, format="WEBP", quality=preset.quality, method=6)
        candidate, ext, mime = out.getvalue(), "webp", "image/webp"

    else:  # PNG
        work.save(out, format="PNG", optimize=True)
        png_bytes = _pngquant(out.getvalue(), preset.quality)
        candidate, ext, mime = png_bytes, "png", "image/png"

    # Si redujimos el tamano en pixeles, conviene quedarse con la version nueva
    # aunque pese algo mas (el usuario pidio explicitamente un tamano menor).
    # Si NO redujimos dimensiones y la version nueva pesa mas, devolvemos el
    # original intacto: recomprimir lo habria empeorado.
    if not resized and len(candidate) >= len(raw):
        return raw, orig_ext, orig_mime

    return candidate, ext, mime