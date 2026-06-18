"""
LayersWork API
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import psd, layers, optimize, plugins, projects
from plugins.base import discover

app = FastAPI(title="LayersWork API")

# Origenes permitidos: localhost para desarrollo + dominio de produccion.
# En produccion se puede anadir mas via la variable ALLOWED_ORIGINS (separados por coma).
default_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "https://layerswork.com",
    "https://www.layerswork.com",
]
extra = os.environ.get("ALLOWED_ORIGINS", "")
if extra:
    default_origins += [o.strip() for o in extra.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=default_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"name": "LayersWork API", "docs": "/docs"}


discover()

app.include_router(psd.router)
app.include_router(layers.router)
app.include_router(optimize.router)
app.include_router(plugins.router)
app.include_router(projects.router)