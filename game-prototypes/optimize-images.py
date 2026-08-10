#!/usr/bin/env python3
"""Create lightweight WebP screenshots and thumbnails for this page.

Original PNG/JPEG files remain the source of truth. This script is safe to
repeat and updates prototypes.json to point at the generated assets.

Requires Pillow: python -m pip install Pillow
"""

from __future__ import annotations

import argparse
import gzip
import json
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / "prototypes.json"
SOURCE_SUFFIXES = (".png", ".jpg", ".jpeg")
COMPRESSIBLE_SUFFIXES = (".html", ".css", ".js", ".json")


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--detail-width", type=int, default=960)
    parser.add_argument("--detail-quality", type=int, default=76)
    parser.add_argument("--thumb-width", type=int, default=96)
    parser.add_argument("--thumb-height", type=int, default=54)
    parser.add_argument("--thumb-quality", type=int, default=36)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def find_source(image_reference: str) -> Path:
    referenced = ROOT / image_reference
    if referenced.suffix.lower() in SOURCE_SUFFIXES and referenced.exists():
        return referenced
    for suffix in SOURCE_SUFFIXES:
        candidate = referenced.with_suffix(suffix)
        if candidate.exists():
            return candidate
    raise FileNotFoundError(f"No source image found for {image_reference}")


def save_webp(image: Image.Image, destination: Path, quality: int, dry_run: bool) -> int:
    if dry_run:
        return destination.stat().st_size if destination.exists() else 0
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "WEBP", quality=quality, method=6, optimize=True)
    return destination.stat().st_size


def estimated_initial_transfer(manifest: dict) -> int:
    files = [
        ROOT / "index.html",
        ROOT / "index.js",
        ROOT / "styles.css",
        MANIFEST,
        ROOT.parent / "core.css",
        ROOT.parent / "header.gif",
        ROOT.parent / "favicon.jpg",
    ]
    files.extend(ROOT / item["thumbnail"] for item in manifest["prototypes"] if item.get("thumbnail"))
    return sum(
        len(gzip.compress(path.read_bytes(), compresslevel=9, mtime=0))
        if path.suffix.lower() in COMPRESSIBLE_SUFFIXES
        else path.stat().st_size
        for path in files
    )


def main() -> None:
    args = arguments()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    total = 0
    for prototype in manifest.get("prototypes", []):
        image_reference = prototype.get("image")
        if not image_reference:
            continue
        source = find_source(image_reference)
        detail = source.with_suffix(".webp")
        thumbnail = source.with_name(f"{source.stem}-thumb.webp")
        with Image.open(source) as opened:
            original = ImageOps.exif_transpose(opened).convert("RGB")
            detail_image = original.copy()
            detail_image.thumbnail((args.detail_width, args.detail_width), Image.Resampling.LANCZOS)
            thumb_image = ImageOps.fit(
                original,
                (args.thumb_width, args.thumb_height),
                method=Image.Resampling.LANCZOS,
            )
            detail_bytes = save_webp(detail_image, detail, args.detail_quality, args.dry_run)
            thumb_bytes = save_webp(thumb_image, thumbnail, args.thumb_quality, args.dry_run)
        prototype["image"] = detail.relative_to(ROOT).as_posix()
        prototype["thumbnail"] = thumbnail.relative_to(ROOT).as_posix()
        total += detail_bytes + thumb_bytes
        print(
            f"{source.relative_to(ROOT)} -> {detail.name} ({detail_bytes / 1024:.1f} KiB), "
            f"{thumbnail.name} ({thumb_bytes / 1024:.1f} KiB)"
        )
    if not args.dry_run:
        MANIFEST.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    print(f"Generated image total: {total / 1024:.1f} KiB")
    transfer = estimated_initial_transfer(manifest)
    print(f"Estimated initial page transfer (gzip): {transfer / 1024:.1f} KiB")


if __name__ == "__main__":
    main()
