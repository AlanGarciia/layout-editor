"""
Optimizacion de SVG con scour (Python puro, sin dependencias del sistema).
"""

from scour import scour


def optimize_svg(svg_text: str) -> str:
    """Optimiza un SVG y devuelve el SVG optimizado como texto."""
    options = scour.parse_args([
        "--enable-id-stripping",
        "--enable-comment-stripping",
        "--shorten-ids",
        "--remove-metadata",
        "--strip-xml-prolog",
        "--no-line-breaks",
    ])
    return scour.scourString(svg_text, options)