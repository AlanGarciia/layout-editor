"""
Plugin: convertir una imagen (PNG/JPG) en un PSD de una sola capa.
A diferencia del endpoint viejo (que recibia capas ya rasterizadas en JSON),
este plugin acepta directamente el archivo de imagen y lo envuelve en un PSD.
Devuelve el PSD como binario para descargar.
"""

import io
from typing import Any, Dict

from PIL import Image
from psd_tools import PSDImage
from psd_tools.api.layers import PixelLayer

from plugins.base import Plugin, PluginResult, register


@register
class PsdExportPlugin(Plugin):
    name = "psd_export"
    title = "Convertir imagen a PSD"
    accepts = ["image/png", "image/jpeg", "image/webp"]
    premium = False

    def run(self, raw: bytes, params: Dict[str, Any]) -> PluginResult:
        img = Image.open(io.BytesIO(raw)).convert("RGBA")
        w, h = img.size

        psd = PSDImage.new(mode="RGBA", size=(w, h))
        layer = PixelLayer.frompil(img, psd, layer_name="Imagen", top=0, left=0)
        psd.append(layer)

        buf = io.BytesIO()
        psd.save(buf)
        buf.seek(0)

        return PluginResult(
            media_type="image/vnd.adobe.photoshop",
            content=buf.getvalue(),
            filename="export.psd",
        )