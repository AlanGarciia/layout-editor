"""
Sistema de plugins
------------------
Cada plugin hereda de Plugin y se auto-registra con el decorador @register.
El endpoint generico /api/plugins/{name}/run los ejecuta por nombre.

Anadir una herramienta nueva = crear un archivo en plugins/ con una clase
decorada con @register. El descubridor (discover) los importa todos solos.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, Type, Optional


@dataclass
class PluginResult:
    """Resultado uniforme de cualquier plugin."""
    media_type: str                                   # "image/png", "application/json", ...
    content: Optional[bytes] = None                   # binario (imagen/psd) si aplica
    data: Dict[str, Any] = field(default_factory=dict)  # json si aplica
    filename: Optional[str] = None                    # nombre de descarga si aplica


class Plugin(ABC):
    # metadatos (tambien sirven para listar plugins y para SEO)
    name: str = ""                 # slug unico: "image_to_layers"
    title: str = ""                # titulo legible
    accepts: list[str] = []        # mimetypes de entrada
    premium: bool = False          # si requiere suscripcion

    @abstractmethod
    def run(self, raw: bytes, params: Dict[str, Any]) -> PluginResult:
        """Procesa la entrada (bytes del archivo) y devuelve un PluginResult."""
        ...


# --- Registro automatico ---
_REGISTRY: Dict[str, Plugin] = {}


def register(cls: Type[Plugin]) -> Type[Plugin]:
    """Decorador: instancia el plugin y lo registra por su name."""
    instance = cls()
    if not instance.name:
        raise ValueError(f"El plugin {cls.__name__} no define 'name'.")
    if instance.name in _REGISTRY:
        raise ValueError(f"Plugin duplicado: {instance.name}")
    _REGISTRY[instance.name] = instance
    return cls


def get_plugin(name: str) -> Optional[Plugin]:
    return _REGISTRY.get(name)


def all_plugins() -> Dict[str, Plugin]:
    return dict(_REGISTRY)


def discover() -> None:
    """
    Importa todos los modulos .py de la carpeta plugins/ para que sus
    decoradores @register se ejecuten y se registren. Se llama una vez al
    arrancar la app.
    """
    import importlib
    import pkgutil
    import plugins as plugins_pkg

    for mod in pkgutil.iter_modules(plugins_pkg.__path__):
        if mod.name == "base":
            continue
        importlib.import_module(f"plugins.{mod.name}")