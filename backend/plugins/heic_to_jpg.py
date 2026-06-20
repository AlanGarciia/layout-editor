"""
Plugin: heic_to_jpg
-------------------
Convierte imagenes HEIC/HEIF (formato de fotos de iPhone) a JPG.
Util porque muchas personas no pueden abrir los .heic en Windows o
subirlos a webs que solo aceptan JPG/PNG.

Ligero: no usa IA, solo decodifica con pillow-heif y reexporta como JPG.
"""

import io
from typing import Any, Dict

from PIL import Image
import pillow_heif

from plugins.base import Plugin, PluginResult, register

# registra el decodificador HEIF en Pillow (necesario una vez)
pillow_heif.register_heif_opener()


@register
class HeicToJpgPlugin(Plugin):
    name = "heic_to_jpg"
    title = "Convertir HEIC a JPG"
    accepts = ["image/heic", "image/heif", ".heic", ".heif"]
    premium = False

    def run(self, raw: bytes, params: Dict[str, Any]) -> PluginResult:
        img = Image.open(io.BytesIO(raw))

        # JPG no admite transparencia: aplanamos sobre fondo blanco si hace falta
        if img.mode in ("RGBA", "P", "LA"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            img = img.convert("RGBA")
            background.paste(img, mask=img.split()[-1])
            img = background
        else:
            img = img.convert("RGB")

        # calidad del JPG (configurable por params, por defecto 90)
        quality = int(params.get("quality", 90))
        quality = max(1, min(100, quality))

        out = io.BytesIO()
        img.save(out, format="JPEG", quality=quality, optimize=True)
        out.seek(0)

        return PluginResult(
            media_type="image/jpeg",
            content=out.getvalue(),
            filename="convertida.jpg",
        )