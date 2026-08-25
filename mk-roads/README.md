# MK Roads

Every road node in the North Macedonian state road register, pulled out of the
official PDFs and put on a map.

Data comes from the Public Enterprise for State Roads register at
<https://webgis.roads.org.mk/roads/index.php>.

## What's here

| File | What it does |
|---|---|
| `scrape.py` | Crawls the register, downloads the node PDFs, reads the coordinates, writes `data/roads.json` |
| `mk_proj.py` | Macedonian state grid → WGS84, in pure Python |
| `index.html` | The map viewer. Opens `data/roads.json` |
| `data/roads.json` | The scraped output |
| `cache/` | Downloaded PDFs, kept so re-runs are fast. Safe to delete |

## Scraping

One dependency, for reading text out of the PDFs:

```
pip install pymupdf
```

Then:

```
python scrape.py
```

Re-run it whenever you want to pick up newly published roads — PDFs already in
`cache/` are reused, so a repeat run only fetches what's new.

```
python scrape.py --limit 2     # first 2 roads only, for a quick check
python scrape.py --refresh     # re-download everything
python scrape.py --sections    # also fetch the per-section PDFs
python scrape.py --datum mk7   # use a different datum shift
```

## Viewing

`index.html` reads `data/roads.json` over HTTP, so serve the folder rather than
double-clicking the file:

```
python -m http.server 8000
```

and open <http://localhost:8000>. (Opening the file directly still works — the
page will offer a file picker for `roads.json` — but serving it is smoother.)

Search roads or nodes, filter by road class, click a node for its coordinates
and a link back to the source PDF.

## How the site is put together

Worth writing down, because none of it is documented and it's all a bit
indirect:

1. `index.php` renders a `<select>` of 113 roads, each `<option value="N">`
   carrying an internal road id.
2. Picking one calls `php/ajax_actions.php?id=1&id2=<roadId>&l=en&lng=3`, which
   returns an HTML table of that road's sections.
3. Every row links to two PDFs: a section report at
   `files/Sections/RAMS_report-Section__<id>.pdf` and node reports at
   `files/Nodes/RAMS_report-Node__<id>.pdf`.
4. The node PDFs are where the coordinates live.

`scrape.py` classifies table cells by which PDF they link to rather than by
column position, so a layout change on the site produces missing data and a
loud complaint instead of quietly mismatched columns.

## Coordinates, and one caveat worth reading

The node PDFs give positions in the Macedonian state grid — Gauss-Krüger zone 7
on the Bessel 1841 ellipsoid (MGI 1901 / Balkans zone 7, EPSG:6316), central
meridian 21°E, scale 0.9999, false easting 7 500 000. Node 158, the Tabanovce
border crossing, reads `X 7558480,48  Y 4677200,67`.

`mk_proj.py` inverts that projection exactly. Getting from there to WGS84 needs
a **datum shift**, and this is the soft spot: several parameter sets are in
circulation for this region and they disagree by up to ~900 m. `DATUMS` in
`mk_proj.py` holds the candidates and `DEFAULT_DATUM` picks one.

Two ways to tell whether the current choice is right:

- **The map.** Motorway nodes should sit *on* the motorway. A consistent offset
  in one direction means the datum shift is wrong, not the projection.
- **`scrape.py`'s length cross-check.** It compares the straight-line distance
  between each section's two nodes against the published section length. Real
  sections curve, so straight-line is always a bit shorter; a small consistent
  gap means the projection is right. This checks the projection, not the datum
  shift — a translation moves every node together and leaves distances intact.

To switch: `python scrape.py --datum mk7`, or change `DEFAULT_DATUM`.

## Data shape

```jsonc
{
  "generated": "2026-08-23T…",
  "crs":   { "source": "…EPSG:6316…", "datum_shift": "balkans" },
  "stats": { "roads": 113, "sections": 0, "nodes": 0, "problems": 0 },
  "roads": [
    { "id": "1", "code": "A1", "name": "…", "name_mk": "…",
      "sections": [
        { "section": "0001", "name": "…", "length_m": 5664,
          "from": { "id": "158", "name": "…" },
          "to":   { "id": "547", "name": "…" },
          "pdf":  "https://…/RAMS_report-Section__0001.pdf" }
      ] }
  ],
  "nodes": {
    "158": { "id": "158", "name": "Drzhavna granica RS/MK (Tabanovce)",
             "x": 7558480.48, "y": 4677200.67,
             "lat": 42.236828, "lon": 21.703295,
             "roads": ["A1"], "pdf": "https://…/RAMS_report-Node__158.pdf" }
  },
  "problems": [ { "node": "…", "reason": "…" } ]
}
```

`problems` lists every node the scraper could not place, and why. It is worth a
look after each run — an empty list means nothing was silently dropped.

The map draws straight lines between consecutive nodes. Those are **schematic
links, not road geometry** — the register publishes node positions, not
centrelines, so the lines show which nodes connect, not where the tarmac goes.
