"""
Plugin: separar una imagen en capas por color.
Envuelve la logica existente en services/color_split.py.
Devuelve JSON con las capas (cada una PNG en base64).
"""

from typing import Any, Dict

from plugins.base import Plugin, PluginResult, register
from services.color_split import split_by_color


@register
class ImageToLayersPlugin(Plugin):
    name = "image_to_layers"
    title = "Separar imagen en capas por color"
    accepts = ["image/png", "image/jpeg", "image/webp"]
    premium = False

    def run(self, raw: bytes, params: Dict[str, Any]) -> PluginResult:
        n_colors = int(params.get("n_colors", 12))
        merge_dist = float(params.get("merge_dist", 50))
        min_percent = float(params.get("min_percent", 1.5))
        result = split_by_color(raw, n_colors, merge_dist, min_percent)
        return PluginResult(media_type="application/json", data=result)