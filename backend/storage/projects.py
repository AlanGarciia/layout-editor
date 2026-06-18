"""
Storage de proyectos temporales (JSON en disco).
-------------------------------------------------
Cada proyecto se guarda como un .json en storage_data/ con un id unico.
Son temporales: al leer o listar, los que superan MAX_AGE_HOURS se borran.

Estructura de un proyecto:
  { "width": int, "height": int, "layers": [ ... ] }
Las capas son tal cual las maneja el editor (con su PNG en base64).
"""

import json
import os
import time
import uuid
from typing import Any, Dict, Optional

# Carpeta donde se guardan los proyectos (junto al backend)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "storage_data")

# Tiempo de vida de un proyecto antes de borrarse
MAX_AGE_HOURS = 24


def _ensure_dir() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)


def _path(project_id: str) -> str:
    # solo permitimos ids generados por nosotros (hex), evita path traversal
    safe = "".join(c for c in project_id if c.isalnum())
    return os.path.join(DATA_DIR, f"{safe}.json")


def cleanup_old() -> None:
    """Borra proyectos mas viejos que MAX_AGE_HOURS."""
    _ensure_dir()
    cutoff = time.time() - MAX_AGE_HOURS * 3600
    for fname in os.listdir(DATA_DIR):
        if not fname.endswith(".json"):
            continue
        fpath = os.path.join(DATA_DIR, fname)
        try:
            if os.path.getmtime(fpath) < cutoff:
                os.remove(fpath)
        except OSError:
            pass


def save_project(data: Dict[str, Any]) -> str:
    """Guarda un proyecto y devuelve su id."""
    _ensure_dir()
    cleanup_old()
    project_id = uuid.uuid4().hex
    with open(_path(project_id), "w", encoding="utf-8") as f:
        json.dump(data, f)
    return project_id


def load_project(project_id: str) -> Optional[Dict[str, Any]]:
    """Carga un proyecto por id. Devuelve None si no existe o caduco."""
    cleanup_old()
    fpath = _path(project_id)
    if not os.path.exists(fpath):
        return None
    try:
        with open(fpath, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None