"""
Fase 2 - Comprimir y optimizar imagenes raster
----------------------------------------------
Recibe un archivo (PNG/JPG/WebP) y un preset, y devuelve la version
optimizada. La optimizacion de SVG se hace en el frontend con SVGO,
asi que aqui solo se manejan imagenes raster.

Endpoints:
  GET  /optimize/presets        -> lista de presets disponibles
  POST /optimize/image          -> optimiza una imagen (multipart/form-data)
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response

from services.raster import optimize_image, PRESETS, PNGQUANT

router = APIRouter(prefix="/optimize", tags=["optimize"])


@router.get("/presets")
def list_presets():
    """Devuelve los presets y si pngquant esta disponible."""
    return {
        "pngquant_available": bool(PNGQUANT),
        "presets": [
            {
                "id": p.name,
                "max_size": p.max_size,
                "quality": p.quality,
                "format": p.fmt,
            }
            for p in PRESETS.values()
        ],
    }


@router.post("/image")
async def optimize(
    file: UploadFile = File(...),
    preset: str = Form("web"),
):
    """
    Optimiza una imagen raster segun el preset elegido.
    Devuelve el archivo optimizado con cabeceras que informan del ahorro.
    """
    if preset not in PRESETS:
        raise HTTPException(status_code=400, detail=f"Preset desconocido: {preset}")

    raw = await file.read()
    original_size = len(raw)
    if original_size == 0:
        raise HTTPException(status_code=400, detail="Archivo vacio.")

    try:
        result, ext, mime = optimize_image(raw, preset)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo procesar la imagen: {e}")

    new_size = len(result)
    # Nombre de salida: nombre original sin extension + preset + nueva extension
    base = (file.filename or "imagen").rsplit(".", 1)[0]
    out_name = f"{base}-{preset}.{ext}"

    return Response(
        content=result,
        media_type=mime,
        headers={
            "Content-Disposition": f'attachment; filename="{out_name}"',
            # cabeceras propias para que el frontend muestre el ahorro
            "X-Original-Size": str(original_size),
            "X-New-Size": str(new_size),
            "X-Output-Name": out_name,
            # hay que exponerlas para que el navegador las deje leer via fetch
            "Access-Control-Expose-Headers": "X-Original-Size, X-New-Size, X-Output-Name",
        },
    )