"""
Servicio de separacion de un PNG/JPG en capas por color.
--------------------------------------------------------
Cuantiza la imagen a N colores dominantes y luego AGRUPA colores parecidos
para no acabar con demasiadas capas. Tres controles:

  - n_colors:    colores iniciales de la cuantizacion (mas = mas detalle)
  - merge_dist:  distancia maxima para fusionar dos colores parecidos
                 (0 = no fusionar; ~30-60 agrupa tonos similares)
  - min_percent: % minimo de pixeles para que una capa sobreviva; las capas
                 mas pequenas se reparten al color superviviente mas cercano

El resultado: menos capas, mas limpias, y procesado mas ligero en el front.

RENDIMIENTO: cada capa se RECORTA a su bounding box (el rectangulo minimo que
contiene sus pixeles) y se devuelve con su posicion (x, y). Asi, una capa que
solo tiene color en una zona no ocupa el lienzo entero: el front dibuja
imagenes pequenas en su sitio en vez de imagenes del tamano completo. Esto
quita los tirones al mover capas con imagenes grandes.

Requiere NumPy (pip install numpy).
"""

import io
import base64
from typing import List, Dict

import numpy as np
from PIL import Image


def _to_data_url(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def _color_distance(c1, c2) -> float:
    """Distancia euclidea simple en RGB."""
    return float(np.sqrt(sum((a - b) ** 2 for a, b in zip(c1, c2))))


def split_by_color(
    raw: bytes,
    n_colors: int = 12,
    merge_dist: float = 40.0,
    min_percent: float = 1.0,
) -> Dict:
    """
    Separa la imagen en capas por color, agrupando colores parecidos.
    Devuelve { width, height, layers: [{name, hex, pixels, png, x, y, w, h}, ...] }.
    Cada capa viene RECORTADA a su bounding box; (x, y) es su posicion en el lienzo.
    """
    n_colors = max(2, min(64, int(n_colors)))

    src = Image.open(io.BytesIO(raw)).convert("RGBA")

    # Limita el tamano para que el procesado sea fluido y las capas no pesen tanto.
    MAX_SIDE = 2000
    longest = max(src.size)
    if longest > MAX_SIDE:
        ratio = MAX_SIDE / longest
        new_size = (round(src.width * ratio), round(src.height * ratio))
        src = src.resize(new_size, Image.LANCZOS)

    w, h = src.size

    arr = np.asarray(src)
    alpha = arr[:, :, 3]
    opaque = alpha >= 8

    rgb = src.convert("RGB")
    quantized = rgb.quantize(colors=n_colors, method=Image.MEDIANCUT)
    palette = quantized.getpalette()
    idx = np.asarray(quantized, dtype=np.int32)  # (h, w)

    # Colores de la paleta realmente presentes en pixeles visibles
    present = np.unique(idx[opaque])

    # --- Info por color: rgb y numero de pixeles ---
    infos = []
    for ci in present:
        r, g, b = palette[ci * 3], palette[ci * 3 + 1], palette[ci * 3 + 2]
        count = int(((idx == ci) & opaque).sum())
        if count == 0:
            continue
        infos.append({"idx": int(ci), "rgb": (r, g, b), "count": count})

    total_visible = sum(i["count"] for i in infos) or 1

    # --- Paso 1: fusionar colores parecidos (merge_dist) ---
    infos.sort(key=lambda i: i["count"], reverse=True)
    clusters = []  # cada cluster: { rgb, count, members:set(idx) }

    for info in infos:
        placed = False
        for cl in clusters:
            if _color_distance(info["rgb"], cl["rgb"]) <= merge_dist:
                cl["members"].add(info["idx"])
                cl["count"] += info["count"]
                placed = True
                break
        if not placed:
            clusters.append({
                "rgb": info["rgb"],
                "count": info["count"],
                "members": {info["idx"]},
            })

    # --- Paso 2: descartar clusters pequenos (min_percent) ---
    min_pixels = (min_percent / 100.0) * total_visible
    big = [c for c in clusters if c["count"] >= min_pixels]
    small = [c for c in clusters if c["count"] < min_pixels]

    if not big:
        big = [max(clusters, key=lambda c: c["count"])]
        small = [c for c in clusters if c not in big]

    for sc in small:
        nearest = min(big, key=lambda c: _color_distance(sc["rgb"], c["rgb"]))
        nearest["members"] |= sc["members"]
        nearest["count"] += sc["count"]

    # --- Paso 3: construir una capa por cluster, RECORTADA a su bounding box ---
    layers: List[Dict] = []
    for cl in big:
        r, g, b = cl["rgb"]
        hex_color = f"#{r:02x}{g:02x}{b:02x}"

        # mascara: pixeles cuyo indice pertenece a este cluster Y visibles
        member_mask = np.isin(idx, list(cl["members"])) & opaque
        count = int(member_mask.sum())
        if count == 0:
            continue

        # --- bounding box de la mascara ---
        rows = np.any(member_mask, axis=1)
        cols = np.any(member_mask, axis=0)
        ymin, ymax = np.where(rows)[0][[0, -1]]
        xmin, xmax = np.where(cols)[0][[0, -1]]
        bw = int(xmax - xmin + 1)
        bh = int(ymax - ymin + 1)

        # recorta la mascara y el alpha al bounding box
        sub_mask = member_mask[ymin:ymax + 1, xmin:xmax + 1]
        sub_alpha = alpha[ymin:ymax + 1, xmin:xmax + 1]

        # construye solo la imagen recortada (bw x bh), no el lienzo entero
        layer_arr = np.zeros((bh, bw, 4), dtype=np.uint8)
        layer_arr[sub_mask, 0] = r
        layer_arr[sub_mask, 1] = g
        layer_arr[sub_mask, 2] = b
        layer_arr[sub_mask, 3] = sub_alpha[sub_mask]

        layer_img = Image.fromarray(layer_arr, mode="RGBA")

        layers.append({
            "name": f"Color {hex_color}",
            "hex": hex_color,
            "pixels": count,
            "png": _to_data_url(layer_img),
            "x": int(xmin),
            "y": int(ymin),
            "w": bw,
            "h": bh,
        })

    layers.sort(key=lambda l: l["pixels"], reverse=True)
    return {"width": w, "height": h, "layers": layers}