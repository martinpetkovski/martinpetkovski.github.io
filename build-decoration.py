#!/usr/bin/env python3
"""Rebuild hdr.svg and h2.svg as compact, path-based decorations.

The originals stored one <rect> per mosaic cell (61 and 52 of them) on a pixel
grid, which is why they weighed ~4.8 KB and ~4 KB. Here the viewBox is scaled
so one mosaic cell is one unit, cells sharing a rounded opacity collapse into a
single <path>, the empty left half is cropped away, and the grid-line overlay
that used to live in a CSS data: URI is folded into the same file. The homepage
ends up with two small assets instead of two big ones plus two inline copies.

Run this only if the artwork needs regenerating; the SVGs are committed.
Source of truth for the cell opacities is the previous version of each file.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BUCKETS = 6          # opacity steps kept
FLOOR = 0.10         # cells fainter than this never show, so drop them


def read_cells(path):
    source = path.read_text(encoding="utf-8")
    cells = []
    for chunk in re.findall(r"<rect ([^/]*)/>", source):
        attrs = dict(re.findall(r"([\w-]+)='([^']*)'", chunk))
        if "opacity" not in attrs or "x" not in attrs:
            continue
        cells.append((int(attrs["x"]), int(attrs["y"]), float(attrs["opacity"])))
    return cells


def trim(value):
    text = ("%.3f" % value).rstrip("0").rstrip(".")
    return text[1:] if text.startswith("0.") else text


def mosaic_paths(cells, origin_x, cell):
    grouped = {}
    for x, y, opacity in cells:
        if opacity < FLOOR:
            continue
        step = round(opacity * BUCKETS) / BUCKETS
        if step <= 0:
            continue
        grouped.setdefault(step, []).append(((x - origin_x) // cell, y // cell))

    out = []
    for step in sorted(grouped):
        moves = "".join("M%d %dh1v1h-1z" % (x, y) for x, y in sorted(grouped[step]))
        out.append("<path opacity='%s' d='%s'/>" % (trim(step), moves))
    return "".join(out)


def grid_path(columns, rows):
    verticals = "".join("M%d 0V%d" % (x, rows) for x in range(1, columns))
    horizontals = "".join("M0 %dH%d" % (y, columns) for y in range(1, rows))
    return verticals + horizontals


def build(name, width, height, origin_x, cell, fade_start, fade_full):
    source = ROOT / name
    cells = read_cells(source)
    view_width = width - origin_x
    columns, rows = view_width // cell, height // cell

    def ratio(absolute):
        return trim(round((absolute - origin_x) / view_width, 3))

    svg = (
        "<svg xmlns='http://www.w3.org/2000/svg' width='%d' height='%d' "
        "viewBox='0 0 %d %d' shape-rendering='crispEdges'>"
        "<defs><linearGradient id='f' x1='0' x2='1'>"
        "<stop offset='0' stop-color='#fff' stop-opacity='0'/>"
        "<stop offset='%s' stop-color='#fff' stop-opacity='0'/>"
        "<stop offset='%s' stop-color='#fff'/></linearGradient>"
        "<linearGradient id='g' x1='0' x2='1'>"
        "<stop offset='0' stop-color='#fff' stop-opacity='0'/>"
        "<stop offset='1' stop-color='#fff'/></linearGradient>"
        "<mask id='m'><rect width='%d' height='%d' fill='url(#f)'/></mask></defs>"
        "<g fill='#fff' mask='url(#m)'>%s</g>"
        "<path fill='none' stroke='url(#g)' vector-effect='non-scaling-stroke' "
        "d='%s'/></svg>"
    ) % (view_width, height, columns, rows,
         ratio(fade_start), ratio(fade_full), columns, rows,
         mosaic_paths(cells, origin_x, cell),
         grid_path(columns, rows))

    before = source.stat().st_size
    source.write_text(svg, encoding="utf-8")
    print("%s %d -> %d bytes" % (name, before, len(svg.encode("utf-8"))))


if __name__ == "__main__":
    build("hdr.svg", 320, 80, 128, 16, 0.48 * 320, 0.78 * 320)
    build("h2.svg", 224, 24, 88, 8, 0.46 * 224, 0.78 * 224)
