#!/usr/bin/env python3
"""
MK Roads - discovery step.

Downloads the raw markup of the road index (all 3 languages) plus every
same-origin JS/CSS file it references, into ./_discovery/.

This is a one-time reconnaissance run so the real scraper can be written
against the site's actual structure. Run it with:

    python discover.py

No third-party packages required.
"""

import os
import re
import ssl
import sys
import json
import urllib.request
import urllib.parse

BASE = "https://webgis.roads.org.mk/roads/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_discovery")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")


def make_ctx():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        pass
    try:
        ctx = ssl.create_default_context()
        # quick probe
        urllib.request.urlopen(
            urllib.request.Request(BASE, headers={"User-Agent": UA}),
            timeout=20, context=ctx).read(64)
        return ctx
    except ssl.SSLError:
        print("  ! TLS verification failed - falling back to unverified context")
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    except Exception:
        return ssl.create_default_context()


CTX = None


def get(url, timeout=45):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9,mk;q=0.8",
    })
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
        return r.status, r.read(), dict(r.headers)


def save(name, data):
    path = os.path.join(OUT, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    mode = "wb" if isinstance(data, bytes) else "w"
    with open(path, mode, **({} if mode == "wb" else {"encoding": "utf-8"})) as f:
        f.write(data)
    return path


def main():
    global CTX
    os.makedirs(OUT, exist_ok=True)
    CTX = make_ctx()

    report = {"base": BASE, "pages": {}, "assets": [], "candidates": []}
    all_html = ""

    for lang in ("en", "mk", "sqi"):
        url = urllib.parse.urljoin(BASE, "index.php?l=%s" % lang)
        try:
            status, body, hdrs = get(url)
        except Exception as e:
            print("  ! %s -> %s" % (url, e))
            report["pages"][lang] = {"url": url, "error": str(e)}
            continue
        name = "index_%s.html" % lang
        save(name, body)
        text = body.decode("utf-8", "replace")
        all_html += text
        report["pages"][lang] = {"url": url, "status": status,
                                 "bytes": len(body), "file": name}
        print("  ok %-8s %7d bytes -> %s" % (lang, len(body), name))

    # every referenced script / stylesheet, same origin
    refs = set()
    for m in re.finditer(r'(?:src|href)\s*=\s*["\']([^"\']+\.(?:js|css))(?:\?[^"\']*)?["\']',
                         all_html, re.I):
        refs.add(m.group(1))

    for ref in sorted(refs):
        url = urllib.parse.urljoin(BASE, ref)
        if "webgis.roads.org.mk" not in url:
            report["assets"].append({"url": url, "skipped": "external"})
            continue
        try:
            status, body, _ = get(url)
        except Exception as e:
            report["assets"].append({"url": url, "error": str(e)})
            print("  ! %s -> %s" % (url, e))
            continue
        name = "assets/" + re.sub(r'[^A-Za-z0-9._-]', "_", ref.lstrip("./"))
        save(name, body)
        report["assets"].append({"url": url, "status": status,
                                 "bytes": len(body), "file": name})
        print("  ok asset  %7d bytes -> %s" % (len(body), name))

    # anything that smells like a document or detail endpoint
    pool = all_html + "".join(
        open(os.path.join(OUT, a["file"]), encoding="utf-8", errors="replace").read()
        for a in report["assets"] if a.get("file")
    )
    pats = [
        r'["\'\(]([^"\'\)\s]*\.pdf[^"\'\)\s]*)',
        r'["\'\(]([^"\'\)\s]*(?:php|asp|aspx)\?[^"\'\)\s]+)',
        r'(?:href|action|url|src)\s*[:=]\s*["\']([^"\']+)["\']',
    ]
    seen = set()
    for p in pats:
        for m in re.finditer(p, pool, re.I):
            v = m.group(1)
            if v and v not in seen and not v.startswith(("data:", "#", "mailto:")):
                seen.add(v)
                report["candidates"].append(v)

    save("report.json", json.dumps(report, indent=2, ensure_ascii=False))

    print("\nSaved %d pages, %d assets, %d candidate URLs into %s"
          % (len(report["pages"]), len(report["assets"]),
             len(report["candidates"]), OUT))
    print("Done. Tell Claude the discovery run finished.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
