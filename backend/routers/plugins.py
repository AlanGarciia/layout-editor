# backend/routers/plugins.py
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response, JSONResponse
import json
from plugins.base import get_plugin, all_plugins

router = APIRouter(prefix="/api/plugins", tags=["plugins"])


@router.get("")
def list_plugins():
    """Lista plugins disponibles (para el frontend y debug)."""
    return [
        {"name": p.name, "title": p.title, "accepts": p.accepts, "premium": p.premium}
        for p in all_plugins().values()
    ]


@router.post("/{name}/run")
async def run_plugin(name: str, file: UploadFile = File(...), params: str = Form("{}")):
    plugin = get_plugin(name)
    if not plugin:
        raise HTTPException(404, f"Plugin no encontrado: {name}")

    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Archivo vacio.")

    result = plugin.run(raw, json.loads(params))

    if result.media_type == "application/json":
        return JSONResponse(result.data)
    return Response(
        content=result.content,
        media_type=result.media_type,
        headers={"Content-Disposition": f'attachment; filename="{result.filename}"'} if result.filename else {},
    )