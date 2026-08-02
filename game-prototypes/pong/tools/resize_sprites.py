"""Resize the recovered Pong sprites to match the Full HD reference image."""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
ARCHIVE = ROOT / "archive" / "original-assets"

# Derived from the sprite bounds in the 780x439 screenshot representation of
# the 1920x1080 game screen. The paddle height also matches HEIGHT / 4 in code.
TARGETS = {
    "ball.png": (44, 44),
    "bat.png": (33, 270),
}


def main() -> None:
    ARCHIVE.mkdir(parents=True, exist_ok=True)

    for filename, target_size in TARGETS.items():
        asset = ASSETS / filename
        archived = ARCHIVE / filename
        if not asset.exists():
            raise FileNotFoundError(f"Missing sprite: {asset}")
        if not archived.exists():
            shutil.copy2(asset, archived)

        with Image.open(archived) as source:
            resized = source.convert("RGBA").resize(target_size, Image.Resampling.LANCZOS)
            resized.save(asset, format="PNG", optimize=True)
        print(f"{filename}: {source.size[0]}x{source.size[1]} -> {target_size[0]}x{target_size[1]}")


if __name__ == "__main__":
    main()
