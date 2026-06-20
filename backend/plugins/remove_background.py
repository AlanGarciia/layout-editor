"""
Plugin: remove_background
-------------------------
Quita el fondo de una imagen usando rembg (modelo U^2-Net, IA local).
Se ejecuta en el backend, sin servicios externos ni costes.

El modelo se descarga la primera vez que se usa (~170MB) y se cachea;
por eso la primera ejecucion tarda mas y las siguientes son rapidas.

Devuelve un PNG con transparencia (el fondo eliminado), listo para descargar.
"""

import io
from typing import Any, Dict

from PIL import Image

from plugins.base import Plugin, PluginResult, register

# La sesion de rembg se crea una vez y se reutiliza (lazy).
_session = None


def _get_session():
    global _session
    if _session is None:
        from rembg import new_session
        _session = new_session("u2net")
    return _session


@register
class RemoveBackgroundPlugin(Plugin):
    name = "remove_background"
    title = "Quitar fondo de imagen"
    accepts = ["image/png", "image/jpeg", "image/webp"]
    premium = False

    def run(self, raw: bytes, params: Dict[str, Any]) -> PluginResult:
        from rembg import remove

        # Limita el tamano para no consumir RAM de mas con imagenes enormes.
        img = Image.open(io.BytesIO(raw)).convert("RGBA")
        MAX_SIDE = 2000
        longest = max(img.size)
        if longest > MAX_SIDE:
            ratio = MAX_SIDE / longest
            img = img.resize(
                (round(img.width * ratio), round(img.height * ratio)),
                Image.LANCZOS,
            )

        # rembg trabaja sobre bytes PNG
        in_buf = io.BytesIO()
        img.save(in_buf, format="PNG")
        output_bytes = remove(in_buf.getvalue(), session=_get_session())

        # nos aseguramos de devolver un PNG RGBA limpio
        result = Image.open(io.BytesIO(output_bytes)).convert("RGBA")
        out_buf = io.BytesIO()
        result.save(out_buf, format="PNG", optimize=True)
        out_buf.seek(0)

        return PluginResult(
            media_type="image/png",
            content=out_buf.getvalue(),
            filename="sin-fondo.png",
        )