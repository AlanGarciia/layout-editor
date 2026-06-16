"""
Layer Editor + Design Optimizer API
------------------------------------
Monta la app FastAPI y registra los routers:
  - routers/psd.py      -> Fase 1: exportar capas a PSD
  - routers/layers.py   -> Fase 1 (ampliacion): separar imagen en capas por color
  - routers/optimize.py -> Fase 2: comprimir y optimizar archivos de diseno

Arrancar (con el venv activado, desde la carpeta backend/):
    uvicorn main:app --reload --port 8000

Comprobar:
    http://localhost:8000/health   -> {"status": "ok"}
    http://localhost:8000/docs     -> interfaz de prueba de todos los endpoints
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import psd, layers, optimize

app = FastAPI(title="Layer Editor + Design Optimizer API")

# CORS: permite que el frontend de Vite (5173) llame a la API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


# Registra los routers
app.include_router(psd.router)
app.include_router(layers.router)
app.include_router(optimize.router)