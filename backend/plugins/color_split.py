# backend/plugins/color_split.py
from typing import Any, Dict
from plugins.base import Plugin, PluginResult, register
from core.image import load_rgba, limit_size
# ... la logica que ya tienes en services/color_split.py


@register
class ColorSplitPlugin(Plugin):
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