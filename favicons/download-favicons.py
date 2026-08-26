#!/usr/bin/env python3
"""Cache the actual page favicons for links used by the homepage and CV.

Each linked HTML page is inspected for its declared ``<link rel="icon">``.
Relative site links are read directly from this repository; absolute links,
including najjak.com URLs, are downloaded. Conventional/domain icons are used only when a page declares
no usable icon. Outputs are palette-based 16x16 PNGs and favicons.js.

Requires Pillow: python -m pip install Pillow
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from hashlib import sha256
from html.parser import HTMLParser
from io import BytesIO
import json
from pathlib import Path
from urllib.parse import quote, unquote, urljoin, urlparse
from urllib.request import Request, urlopen

from PIL import Image, ImageDraw, ImageOps


OUTPUT = Path(__file__).resolve().parent
ROOT = OUTPUT.parent
SITE_ORIGIN = "https://www.najjak.com"
SITE_HOSTS = {"najjak.com", "www.najjak.com"}
DEFAULT_SOURCES = (
    ROOT / "index.html",
    ROOT / "resume" / "index.html",
    ROOT / "my-code-has-powered" / "index.html",
    ROOT / "vault" / "index.html",
    ROOT / "opinions" / "index.html",
)
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) najjak-favicon-cache/2.0"


@dataclass(frozen=True)
class Target:
    key: str
    url: str
    remote: bool


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []
        self.icons: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "a":
            href = values.get("href") or ""
            if href and not href.startswith(("#", "mailto:", "javascript:")):
                self.links.append(href)
        elif tag == "link":
            rel = (values.get("rel") or "").lower().split()
            href = values.get("href") or ""
            if href and "icon" in rel:
                self.icons.append(href)


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="list pages without downloading or writing files")
    parser.add_argument(
        "sources",
        nargs="*",
        type=Path,
        default=list(DEFAULT_SOURCES),
        help="HTML files to scan (defaults to the homepage, resume and section pages)",
    )
    return parser.parse_args()


def normalize_key(url: str) -> str:
    parsed = urlparse(url)
    hostname = (parsed.hostname or "").lower()
    if hostname.startswith("www."):
        hostname = hostname[4:]
    path = parsed.path or "/"
    if path != "/":
        path = path.rstrip("/")
    return hostname + path


def source_url(path: Path) -> str:
    relative = path.resolve().relative_to(ROOT).as_posix()
    if relative == "index.html":
        return SITE_ORIGIN + "/"
    if relative.endswith("/index.html"):
        relative = relative[: -len("index.html")]
    return SITE_ORIGIN + "/" + relative


def collect_targets(sources: list[Path]) -> list[Target]:
    targets: dict[str, Target] = {}
    for source in sources:
        path = source if source.is_absolute() else ROOT / source
        parser = PageParser()
        parser.feed(path.read_text(encoding="utf-8"))
        base = source_url(path)
        for href in parser.links:
            remote = href.startswith(("http://", "https://"))
            url = urljoin(base, href)
            parsed = urlparse(url)
            if parsed.scheme not in {"http", "https"} or ((parsed.hostname or "").lower() in SITE_HOSTS and not remote):
                continue
            key = normalize_key(url)
            targets.setdefault(key, Target(key, url, remote))
    return sorted(targets.values(), key=lambda item: item.key)


def fetch(url: str) -> tuple[bytes, str, str]:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,image/*;q=0.9,*/*;q=0.8"})
    with urlopen(request, timeout=15) as response:
        payload = response.read(3 * 1024 * 1024)
        content_type = response.headers.get_content_type()
        return payload, response.geturl(), content_type


def local_page_path(url: str) -> Path | None:
    parsed = urlparse(url)
    if (parsed.hostname or "").lower() not in SITE_HOSTS:
        return None
    relative = unquote(parsed.path).lstrip("/")
    candidate = ROOT / relative
    if candidate.is_dir() or not candidate.suffix:
        candidate /= "index.html"
    return candidate if candidate.is_file() else None


def local_icon_payload(page: Path) -> bytes:
    parser = PageParser()
    parser.feed(page.read_text(encoding="utf-8", errors="replace"))
    for href in parser.icons:
        parsed = urlparse(href)
        icon = ROOT / unquote(parsed.path).lstrip("/") if parsed.path.startswith("/") else page.parent / unquote(parsed.path)
        if icon.is_file():
            return icon.read_bytes()
    return (ROOT / "favicon.jpg").read_bytes()


def service_fallback(page_url: str) -> bytes:
    urls = [
        "https://www.google.com/s2/favicons?domain_url=" + quote(page_url, safe="") + "&sz=32",
        "https://www.google.com/s2/favicons?domain=" + quote(urlparse(page_url).hostname or "", safe="") + "&sz=32",
    ]
    last_error: Exception | None = None
    for url in urls:
        try:
            payload, _, _ = fetch(url)
            return payload
        except Exception as error:
            last_error = error
    assert last_error is not None
    raise last_error


def external_icon_payload(page_url: str) -> bytes:
    try:
        page_payload, final_url, content_type = fetch(page_url)
    except Exception:
        return service_fallback(page_url)
    candidates: list[str] = []
    if content_type in {"text/html", "application/xhtml+xml"}:
        parser = PageParser()
        parser.feed(page_payload.decode("utf-8", errors="replace"))
        candidates.extend(urljoin(final_url, href) for href in parser.icons)
    parsed = urlparse(final_url)
    candidates.append(f"{parsed.scheme}://{parsed.netloc}/favicon.ico")

    for candidate in candidates:
        try:
            payload, _, _ = fetch(candidate)
            normalized_png(payload)
            return payload
        except Exception:
            continue

    return service_fallback(final_url)


def normalized_png(payload: bytes) -> bytes:
    with Image.open(BytesIO(payload)) as opened:
        source = ImageOps.exif_transpose(opened).convert("RGBA")
        source.thumbnail((16, 16), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        canvas.alpha_composite(source, ((16 - source.width) // 2, (16 - source.height) // 2))
        compact = canvas.quantize(colors=64, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        output = BytesIO()
        compact.save(output, "PNG", optimize=True, compress_level=9)
        return output.getvalue()


def mail_icon_png() -> bytes:
    canvas = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    color = (26, 63, 119, 255)
    draw.rounded_rectangle((1, 3, 14, 12), radius=1, outline=color, width=2)
    draw.line((2, 4, 7.5, 8, 13, 4), fill=color, width=2)
    output = BytesIO()
    canvas.quantize(colors=8, method=Image.Quantize.FASTOCTREE).save(output, "PNG", optimize=True, compress_level=9)
    return output.getvalue()


def cache_target(target: Target) -> tuple[str, bytes]:
    page = None if target.remote else local_page_path(target.url)
    payload = local_icon_payload(page) if page else external_icon_payload(target.url)
    return target.key, normalized_png(payload)


def write_runtime(icons: dict[str, str]) -> None:
    mapping = json.dumps(icons, sort_keys=True, separators=(",", ":"))
    runtime = f"""// Generated by download-favicons.py. Do not edit by hand.
(() => {{
    'use strict';
    const icons = {mapping};
    const keyFor = url => {{
        let hostname = url.hostname.toLowerCase().replace(/^www\\./, '');
        if (url.origin === window.location.origin && ['127.0.0.1', 'localhost'].includes(hostname)) hostname = 'najjak.com';
        const path = url.pathname === '/' ? '/' : url.pathname.replace(/\\/$/, '');
        return hostname + path;
    }};
    const addFavicons = () => document.querySelectorAll('.favicon-links a[href]').forEach(link => {{
        try {{
            if (link.closest('#info')) return;
            if (!/^(https?:|mailto:)/i.test(link.getAttribute('href') || '')) return;
            const url = new URL(link.href, window.location.href);
            const source = url.protocol === 'mailto:' ? icons['mailto:'] : icons[keyFor(url)];
            if (!source) return;
            link.classList.add('favicon-link');
            if (link.querySelector('img.favicon')) return;
            const image = document.createElement('img');
            image.src = location.protocol === 'file:' ? '..' + source : source;
            image.className = 'favicon';
            image.alt = '';
            image.width = 16;
            image.height = 16;
            image.decoding = 'async';
            link.prepend(image);
        }} catch {{}}
    }});
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addFavicons);
    else addFavicons();
}})();
"""
    (OUTPUT / "favicons.js").write_text(runtime, encoding="utf-8")


def main() -> None:
    args = arguments()
    targets = collect_targets(args.sources)
    if args.dry_run:
        print(f"Found {len(targets)} unique linked pages:")
        print("\n".join(f"{target.key} <- {target.url}" for target in targets))
        return

    icons: dict[str, str] = {}
    mail = mail_icon_png()
    mail_name = f"icon-{sha256(mail).hexdigest()[:12]}.png"
    assets: dict[str, bytes] = {mail_name: mail}
    icons["mailto:"] = f"/favicons/{mail_name}"
    failures: list[str] = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(cache_target, target): target for target in targets}
        for future in as_completed(futures):
            target = futures[future]
            try:
                key, payload = future.result()
                digest = sha256(payload).hexdigest()[:12]
                name = f"icon-{digest}.png"
                assets[name] = payload
                icons[key] = f"/favicons/{name}"
                print(f"{key}: {name} ({len(payload)} bytes)")
            except Exception as error:
                failures.append(target.key)
                print(f"{target.key}: {error}")

    if failures:
        raise SystemExit(f"Failed to resolve {len(failures)} favicon(s): {', '.join(sorted(failures))}")

    for name, payload in assets.items():
        (OUTPUT / name).write_bytes(payload)
    write_runtime(icons)
    keep = set(assets)
    for old in OUTPUT.glob("*.png"):
        if old.name not in keep:
            old.unlink()
    print(f"Cached {len(icons)} page mappings using {len(assets)} unique favicons: {sum(map(len, assets.values())) / 1024:.1f} KiB total")


if __name__ == "__main__":
    main()
