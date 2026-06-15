"""
Layer Editor API
----------------
Recibe capas ya rasterizadas (PNG en base64) desde el frontend y las
compone en un PSD usando psd-tools. No rasteriza nada: evita Cairo.

Arrancar (con el venv activado, desde la carpeta backend/):
    uvicorn main:app --reload --port 8000

Comprobar:
    http://localhost:8000/health   -> {"status": "ok"}
    http://localhost:8000/docs     -> interfaz de prueba
"""

import io
import base64
from typing import List

from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from psd_tools import PSDImage
from psd_tools.api.layers import PixelLayer

app = FastAPI(title="Layer Editor API")

# CORS: permite que el frontend de Vite (5173) llame a la API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Modelos de datos --------------------------------------------------------

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


# --- Utilidades --------------------------------------------------------------

def b64_to_pil(data: str) -> Image.Image:
    """Decodifica un PNG en base64 a imagen RGBA de Pillow."""
    if "," in data:
        data = data.split(",", 1)[1]
    raw = base64.b64decode(data)
    return Image.open(io.BytesIO(raw)).convert("RGBA")


# --- Endpoints ---------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/export/psd")
def export_psd(req: ExportRequest):
    """Compone las capas recibidas en un PSD y lo devuelve como descarga."""
    if not req.layers:
        raise HTTPException(status_code=400, detail="No hay capas para exportar.")

    # Lienzo base transparente del tamano del editor
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