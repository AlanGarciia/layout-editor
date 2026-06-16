"""
Fase 1 - Exportar capas a PSD
-----------------------------
Recibe capas ya rasterizadas (PNG en base64) desde el frontend y las
compone en un PSD usando psd-tools.
"""

import io
import base64
from typing import List

from PIL import Image
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from psd_tools import PSDImage
from psd_tools.api.layers import PixelLayer

router = APIRouter(prefix="/export", tags=["psd"])


class LayerIn(BaseModel):
    name: str
    png: str               # PNG en base64 (con o sin el prefijo data:image/png;base64,)
    x: float = 0
    y: float = 0
    visible: bool = True


class ExportRequest(BaseModel):
    width: int
    height: int
    layers: List[LayerIn]


def b64_to_pil(data: str) -> Image.Image:
    """Decodifica un PNG en base64 a imagen RGBA de Pillow."""
    if "," in data:
        data = data.split(",", 1)[1]
    raw = base64.b64decode(data)
    return Image.open(io.BytesIO(raw)).convert("RGBA")


@router.post("/psd")
def export_psd(req: ExportRequest):
    """Compone las capas recibidas en un PSD y lo devuelve como descarga."""
    if not req.layers:
        raise HTTPException(status_code=400, detail="No hay capas para exportar.")

    psd = PSDImage.new(mode="RGBA", size=(req.width, req.height))

    for layer in req.layers:
        if not layer.visible:
            continue

        try:
            img = b64_to_pil(layer.png)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"No se pudo leer la capa '{layer.name}': {e}",
            )

        left = int(round(layer.x))
        top = int(round(layer.y))

        pixel_layer = PixelLayer.frompil(
            img, psd, layer_name=layer.name, top=top, left=left
        )
        psd.append(pixel_layer)

    buf = io.BytesIO()
    psd.save(buf)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="image/vnd.adobe.photoshop",
        headers={"Content-Disposition": 'attachment; filename="export.psd"'},
    )