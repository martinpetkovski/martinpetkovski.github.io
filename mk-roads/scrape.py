#!/usr/bin/env python3
"""
MK Roads scraper
================

Crawls the Public Enterprise for State Roads road register at
webgis.roads.org.mk, downloads every road-node PDF, reads the state-grid
coordinates out of them, and writes a single data/roads.json.

Usage
-----
    python scrape.py                 # full run (resumes; cached PDFs reused)
    python scrape.py --limit 2       # first 2 roads only - good smoke test
    python scrape.py --refresh       # re-download PDFs even if cached
    python scrape.py --sections      # also fetch the per-section PDFs
    python scrape.py --datum mk7     # use a different datum shift

Re-run it any time; roads already cached are skipped, so picking up newly
published roads is cheap.

Requirements
------------
Standard library, plus ONE pdf text extractor - whichever you have:
    pip install pymupdf        (fastest, recommended)
    pip install pdfplumber
    pip install pypdf
"""

import argparse
import concurrent.futures as futures
import html
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

import mk_proj

BASE = "https://webgis.roads.org.mk/roads/"
INDEX = BASE + "index.php?l=%s"
AJAX = BASE + "php/ajax_actions.php?id=1&id2=%s&l=%s&lng=%s"
LANGS = {"en": 3, "mk": 1, "sqi": 2}

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
CACHE = os.path.join(HERE, "cache")
NODE_DIR = os.path.join(CACHE, "nodes")
SECTION_DIR = os.path.join(CACHE, "sections")
DEBUG = os.path.join(CACHE, "debug")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

_CTX = ssl.create_default_context()


# --------------------------------------------------------------------------
# http
# --------------------------------------------------------------------------
def fetch(url, tries=3, timeout=60):
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": UA,
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.9,mk;q=0.8",
                "Referer": BASE + "index.php",
            })
            with urllib.request.urlopen(req, timeout=timeout, context=_CTX) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise
            last = e
        except Exception as e:                       # noqa: BLE001
            last = e
        time.sleep(1.5 * (attempt + 1))
    raise last


def fetch_text(url, **kw):
    return fetch(url, **kw).decode("utf-8", "replace")


# --------------------------------------------------------------------------
# html helpers
# --------------------------------------------------------------------------
TAG = re.compile(r"<[^>]+>")


def text_of(fragment):
    s = re.sub(r"<br\s*/?>", " ", fragment, flags=re.I)
    s = TAG.sub(" ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def parse_road_list(page_html):
    """<option value="5">P1101 - Prilep ... </option> -> [(id, code, name)]"""
    out = []
    for m in re.finditer(r'<option\s+value="(\d+)"\s*>(.*?)</option>',
                         page_html, re.S | re.I):
        rid, label = m.group(1), text_of(m.group(2))
        if not label:
            continue
        code, _, rest = label.partition(" - ")
        out.append((rid, code.strip(), rest.strip()))
    return out


NODE_PDF = re.compile(r"Nodes/RAMS_report-Node__([0-9]+)\.pdf", re.I)
SECTION_PDF = re.compile(r"Sections/RAMS_report-Section__([0-9A-Za-z]+)\.pdf", re.I)
CELL = re.compile(r"<t[dh][^>]*>(.*?)</t[dh]>", re.S | re.I)
ROW = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S | re.I)


def parse_sections(fragment):
    """Pull the section rows out of the ajax fragment.

    Column order is not assumed: cells are classified by the PDF link they
    carry, so a layout change on the site does not silently corrupt output.
    """
    sections = []
    for row_html in ROW.findall(fragment):
        cells = CELL.findall(row_html)
        if len(cells) < 3:
            continue

        section_id = None
        nodes = []
        numbers = []
        plain = []

        for cell in cells:
            label = text_of(cell)
            n = NODE_PDF.search(cell)
            s = SECTION_PDF.search(cell)
            if n:
                nid = str(int(n.group(1)))
                name = label
                mm = re.match(r"^\s*(\d+)\s*[-–]\s*(.*)$", label)
                if mm and mm.group(1) == nid:
                    name = mm.group(2).strip()
                nodes.append({"id": nid, "name": name})
            elif s:
                section_id = s.group(1)
                plain.append(label)
            else:
                plain.append(label)
                if re.fullmatch(r"[\d.,\s]+", label) and label.strip():
                    numbers.append(label)

        if section_id is None or len(nodes) < 2:
            continue

        length = None
        for raw in numbers:
            try:
                v = float(raw.replace(" ", "").replace(".", "").replace(",", "."))
            except ValueError:
                continue
            if v > 0:
                length = v
                break

        name = ""
        for p in plain:
            if p and not re.fullmatch(r"[\d.,\s]*", p) and p != section_id:
                name = p
                break

        sections.append({
            "section": section_id,
            "name": name,
            "length_m": length,
            "from": nodes[0],
            "to": nodes[-1],
            "pdf": BASE + "files/Sections/RAMS_report-Section__%s.pdf" % section_id,
        })
    return sections


# --------------------------------------------------------------------------
# pdf text extraction
# --------------------------------------------------------------------------
_EXTRACTOR = None


def pdf_text(path):
    global _EXTRACTOR
    if _EXTRACTOR is None:
        _EXTRACTOR = _pick_extractor()
    return _EXTRACTOR(path)


def _pick_extractor():
    try:
        import fitz                                   # PyMuPDF

        def go(path):
            with fitz.open(path) as doc:
                return "\n".join(p.get_text() for p in doc)
        print("  pdf engine: PyMuPDF")
        return go
    except ImportError:
        pass
    try:
        import pdfplumber

        def go(path):
            with pdfplumber.open(path) as doc:
                return "\n".join(p.extract_text() or "" for p in doc.pages)
        print("  pdf engine: pdfplumber")
        return go
    except ImportError:
        pass
    try:
        from pypdf import PdfReader

        def go(path):
            return "\n".join(p.extract_text() or "" for p in PdfReader(path).pages)
        print("  pdf engine: pypdf")
        return go
    except ImportError:
        pass
    sys.exit("No PDF text extractor found.\n"
             "Install one:  pip install pymupdf   (or pdfplumber, or pypdf)")


# Eastings in the MK grid start with 74/75/76, northings with 45/46/47.
# Matching on those ranges makes the reader independent of the PDF's layout
# and of whether the label is Macedonian or English.
EASTING = re.compile(r"\b7[3-6]\d{5}[.,]\d+\b")
NORTHING = re.compile(r"\b4[5-7]\d{5}[.,]\d+\b")
LABELLED = re.compile(r"\b([XY])\b[^0-9\-]{0,20}(\d[\d\s.]*[.,]\d+)", re.I)


def _num(raw):
    raw = raw.replace(" ", "")
    if "," in raw:
        raw = raw.replace(".", "").replace(",", ".")
    return float(raw)


def read_node_coords(path):
    """-> (easting, northing) in the MK state grid, or None."""
    try:
        text = pdf_text(path)
    except Exception as e:                            # noqa: BLE001
        return None, "unreadable: %s" % e
    if not text or not text.strip():
        return None, "no extractable text (scanned image?)"

    labelled = {}
    for axis, raw in LABELLED.findall(text):
        try:
            labelled.setdefault(axis.upper(), _num(raw))
        except ValueError:
            pass

    east = [_num(v) for v in EASTING.findall(text)]
    north = [_num(v) for v in NORTHING.findall(text)]

    x = labelled.get("X") if labelled.get("X", 0) > 7000000 else None
    y = labelled.get("Y") if 4000000 < labelled.get("Y", 0) < 5000000 else None
    if x is None and east:
        x = east[0]
    if y is None and north:
        y = north[0]

    if x is None or y is None:
        return None, "no coordinates found in text"
    if not mk_proj.plausible_grid(x, y):
        return None, "coordinates outside North Macedonia: %s %s" % (x, y)
    return (x, y), None


# --------------------------------------------------------------------------
# downloading
# --------------------------------------------------------------------------
def download(url, path, refresh=False):
    if not refresh and os.path.exists(path) and os.path.getsize(path) > 0:
        return "cached"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        blob = fetch(url)
    except urllib.error.HTTPError as e:
        return "http %s" % e.code
    except Exception as e:                            # noqa: BLE001
        return "error: %s" % e
    if not blob.startswith(b"%PDF"):
        return "not a pdf"
    with open(path, "wb") as f:
        f.write(blob)
    return "downloaded"


def download_all(items, folder, refresh, workers, label):
    results = {}
    done = [0]
    total = len(items)

    def one(key_url):
        key, url = key_url
        path = os.path.join(folder, os.path.basename(urllib.parse.urlparse(url).path))
        status = download(url, path, refresh)
        done[0] += 1
        if done[0] % 25 == 0 or done[0] == total:
            print("    %s %d/%d" % (label, done[0], total))
        return key, path, status

    with futures.ThreadPoolExecutor(max_workers=workers) as pool:
        for key, path, status in pool.map(one, items.items()):
            results[key] = (path, status)
    return results


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Scrape the MK state road register.")
    ap.add_argument("--limit", type=int, help="only the first N roads (smoke test)")
    ap.add_argument("--refresh", action="store_true", help="re-download cached PDFs")
    ap.add_argument("--sections", action="store_true", help="also fetch section PDFs")
    ap.add_argument("--datum", default=mk_proj.DEFAULT_DATUM,
                    choices=sorted(mk_proj.DATUMS), help="datum shift to WGS84")
    ap.add_argument("--workers", type=int, default=6, help="parallel downloads")
    ap.add_argument("--out", default=os.path.join(DATA, "roads.json"))
    args = ap.parse_args()

    for d in (DATA, NODE_DIR, DEBUG):
        os.makedirs(d, exist_ok=True)

    started = time.time()
    print("MK Roads scraper")
    print("  source: %s" % BASE)
    print("  datum : %s\n" % args.datum)

    # 1. road list, in all three languages -----------------------------------
    print("[1/5] road register")
    names = {}
    roads = []
    for lang in ("en", "mk", "sqi"):
        try:
            page = fetch_text(INDEX % lang)
        except Exception as e:                        # noqa: BLE001
            print("  ! %s list failed: %s" % (lang, e))
            continue
        entries = parse_road_list(page)
        print("  %-4s %d roads" % (lang, len(entries)))
        for rid, code, name in entries:
            names.setdefault(rid, {})[lang] = name
            if lang == "en":
                roads.append({"id": rid, "code": code})
    if not roads:
        sys.exit("Could not read the road list - the site layout may have changed.")
    if args.limit:
        roads = roads[:args.limit]
        print("  (limited to %d)" % len(roads))

    # 2. sections per road ---------------------------------------------------
    print("\n[2/5] sections per road")
    node_names = {}
    for i, road in enumerate(roads, 1):
        url = AJAX % (road["id"], "en", LANGS["en"])
        try:
            fragment = fetch_text(url)
        except Exception as e:                        # noqa: BLE001
            print("  ! %s failed: %s" % (road["code"], e))
            road["sections"] = []
            continue
        if i == 1:
            with open(os.path.join(DEBUG, "sections_sample.html"), "w",
                      encoding="utf-8") as f:
                f.write(fragment)
        sections = parse_sections(fragment)
        road["sections"] = sections
        road["name"] = names.get(road["id"], {}).get("en", "")
        road["name_mk"] = names.get(road["id"], {}).get("mk", "")
        road["name_sqi"] = names.get(road["id"], {}).get("sqi", "")
        for s in sections:
            for end in ("from", "to"):
                node_names.setdefault(s[end]["id"], s[end]["name"])
        print("  %3d/%d  %-9s %3d sections" % (i, len(roads), road["code"],
                                               len(sections)))
        time.sleep(0.15)

    print("\n  %d unique nodes referenced" % len(node_names))

    # 3. node PDFs -----------------------------------------------------------
    print("\n[3/5] node PDFs -> %s" % NODE_DIR)
    node_urls = {nid: BASE + "files/Nodes/RAMS_report-Node__%s.pdf" % nid
                 for nid in node_names}
    got = download_all(node_urls, NODE_DIR, args.refresh, args.workers, "nodes")
    fresh = sum(1 for _, s in got.values() if s == "downloaded")
    cached = sum(1 for _, s in got.values() if s == "cached")
    print("    %d downloaded, %d cached, %d failed"
          % (fresh, cached, len(got) - fresh - cached))

    if args.sections:
        print("\n      section PDFs -> %s" % SECTION_DIR)
        sec_urls = {s["section"]: s["pdf"] for r in roads for s in r["sections"]}
        download_all(sec_urls, SECTION_DIR, args.refresh, args.workers, "sections")

    # 4. read coordinates ----------------------------------------------------
    print("\n[4/5] reading coordinates")
    nodes = {}
    problems = []
    samples = []
    for n, (nid, (path, status)) in enumerate(sorted(got.items(),
                                                     key=lambda kv: int(kv[0]))):
        if status not in ("downloaded", "cached"):
            problems.append({"node": nid, "reason": status})
            continue
        if len(samples) < 5:
            try:
                samples.append("=" * 70 + "\nNODE %s  (%s)\n" % (nid, status)
                               + "=" * 70 + "\n" + pdf_text(path))
            except Exception:                          # noqa: BLE001
                pass
        coords, err = read_node_coords(path)
        if coords is None:
            problems.append({"node": nid, "reason": err})
            continue
        x, y = coords
        lat, lon = mk_proj.to_wgs84(x, y, args.datum)
        nodes[nid] = {
            "id": nid,
            "name": node_names.get(nid, ""),
            "x": x,
            "y": y,
            "lat": lat,
            "lon": lon,
            "pdf": node_urls[nid],
        }
        if (n + 1) % 100 == 0:
            print("    parsed %d/%d" % (n + 1, len(got)))

    # raw text of a few PDFs, so the reader can be checked by eye
    if samples:
        with open(os.path.join(DEBUG, "node_text_samples.txt"), "w",
                  encoding="utf-8") as f:
            f.write("\n\n".join(samples))

    print("    %d nodes with coordinates, %d problems" % (len(nodes), len(problems)))

    # which roads each node belongs to
    for road in roads:
        for s in road["sections"]:
            for end in ("from", "to"):
                node = nodes.get(s[end]["id"])
                if node is not None:
                    node.setdefault("roads", [])
                    if road["code"] not in node["roads"]:
                        node["roads"].append(road["code"])

    # 5. write ---------------------------------------------------------------
    print("\n[5/5] writing output")
    geometry_check = check_lengths(roads, nodes)

    payload = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": BASE + "index.php",
        "crs": {
            "source": "MGI 1901 / Balkans zone 7 (EPSG:6316), Gauss-Krueger, "
                      "Bessel 1841, CM 21E, k=0.9999, FE=7500000",
            "target": "WGS84 (EPSG:4326)",
            "datum_shift": args.datum,
            "datum_params": mk_proj.DATUMS[args.datum],
        },
        "stats": {
            "roads": len(roads),
            "sections": sum(len(r["sections"]) for r in roads),
            "nodes": len(nodes),
            "problems": len(problems),
            "length_check": geometry_check,
        },
        "roads": roads,
        "nodes": nodes,
        "problems": problems,
    }

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)

    size = os.path.getsize(args.out) / 1024.0
    print("  %s  (%.0f KB)" % (args.out, size))
    print("\nRoads %d   sections %d   nodes %d   problems %d"
          % (len(roads), payload["stats"]["sections"], len(nodes), len(problems)))
    if geometry_check:
        print("Length cross-check: median error %(median_pct).1f%% over %(compared)d "
              "sections (straight-line vs published length)" % geometry_check)
    print("Done in %.0fs. Open index.html to view the map." % (time.time() - started))


def check_lengths(roads, nodes):
    """Compare straight-line node distance against the published section length.

    Sections are curved, so the straight line is always shorter; a small,
    consistent gap means the projection is right. Wild values mean it is not.
    """
    ratios = []
    for road in roads:
        for s in road["sections"]:
            a, b = nodes.get(s["from"]["id"]), nodes.get(s["to"]["id"])
            if not a or not b or not s.get("length_m"):
                continue
            straight = mk_proj.haversine_m(a["lat"], a["lon"], b["lat"], b["lon"])
            if s["length_m"] > 100:
                ratios.append(straight / s["length_m"])
    if not ratios:
        return None
    ratios.sort()
    median = ratios[len(ratios) // 2]
    return {
        "compared": len(ratios),
        "median_straight_over_published": round(median, 4),
        "median_pct": round(abs(1 - median) * 100, 2),
        "within_20pct": round(
            100.0 * sum(1 for r in ratios if 0.8 <= r <= 1.02) / len(ratios), 1),
    }


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
