"""
Endpoints de proyectos temporales.
  POST /api/projects        -> guarda un proyecto, devuelve { id }
  GET  /api/projects/{id}    -> devuelve el proyecto guardado
"""

from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from storage.projects import save_project, load_project

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectIn(BaseModel):
    width: int
    height: int
    layers: List[Dict[str, Any]]


@router.post("")
def create_project(project: ProjectIn):
    """Guarda un proyecto temporal y devuelve su id."""
    project_id = save_project(project.model_dump())
    return {"id": project_id}


@router.get("/{project_id}")
def get_project(project_id: str):
    """Devuelve un proyecto por id (404 si no existe o caduco)."""
    data = load_project(project_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado o caducado.")
    return data