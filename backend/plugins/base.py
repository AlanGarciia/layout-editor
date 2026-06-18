# backend/plugins/base.py
"""
Sistema de plugins.
Cada plugin hereda de Plugin y se auto-registra al importarse.
El endpoint generico los ejecuta por nombre.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, Type


@dataclass
class PluginResult:
    """Resultado uniforme de cualquier plugin."""
    media_type: str                       # "image/png", "application/json", ...
    content: bytes | None = None          # binario (imagen/psd) si aplica
    data: Dict[str, Any] = field(default_factory=dict)  # json si aplica
    filename: str | None = None


class Plugin(ABC):
    # metadatos que tambien alimentan el SEO/registro
    name: str                  # slug unico: "remove_background"
    title: str                 # "Quitar fondo"
    accepts: list[str]         # mimetypes de entrada: ["image/png", "image/jpeg"]
    premium: bool = False      # si requiere suscripcion

    @abstractmethod
    def run(self, raw: bytes, params: Dict[str, Any]) -> PluginResult:
        """Procesa la entrada y devuelve un PluginResult."""
        ...


# --- Registro automatico ---
_REGISTRY: Dict[str, Plugin] = {}


def register(cls: Type[Plugin]) -> Type[Plugin]:
    """Decorador: registra una instancia del plugin por su name."""
    instance = cls()
    if instance.name in _REGISTRY:
        raise ValueError(f"Plugin duplicado: {instance.name}")
    _REGISTRY[instance.name] = instance
    return cls


def get_plugin(name: str) -> Plugin | None:
    return _REGISTRY.get(name)


def all_plugins() -> Dict[str, Plugin]:
    return dict(_REGISTRY)