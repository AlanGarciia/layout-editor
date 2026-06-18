"""
Fase 1 (ampliacion) - Crear capas desde una imagen plana
--------------------------------------------------------
Separa un PNG/JPG en capas por color, agrupando colores parecidos para
no generar demasiadas capas.

Endpoint:
  POST /layers/split-color   (multipart/form-data)
    file:        imagen (PNG/JPG/WebP)
    n_colors:    colores iniciales de cuantizacion (def. 12)
    merge_dist:  distancia para fusionar colores parecidos (def. 40)
    min_percent: % minimo de pixeles para que una capa exista (def. 1.0)
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from services.color_split import split_by_color

router = APIRouter(prefix="/layers", tags=["layers"])


@router.post("/split-color")
async def split_color(
    file: UploadFile = File(...),
    n_colors: int = Form(12),
    merge_dist: float = Form(40.0),
    min_percent: float = Form(1.0),
):
    """Separa una imagen en capas por color (con agrupacion de tonos similares)."""
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Archivo vacio.")

    try:
        result = split_by_color(
            raw,
            n_colors=n_colors,
            merge_dist=merge_dist,
            min_percent=min_percent,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo separar la imagen: {e}")

    if not result["layers"]:
        raise HTTPException(status_code=400, detail="No se detectaron colores en la imagen.")

    return result