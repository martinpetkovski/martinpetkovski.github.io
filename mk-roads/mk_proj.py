"""
mk_proj.py - Macedonian State Coordinate System -> WGS84, in pure Python.

The RAMS node PDFs publish X/Y in the MK state grid: Gauss-Krueger zone 7 on
the Bessel 1841 ellipsoid (MGI 1901 / Balkans zone 7, EPSG:6316).
    central meridian 21E, scale 0.9999, false easting 7 500 000.

Converting to WGS84 needs a datum shift. Several published parameter sets are
in circulation for this region and they disagree by a few hundred metres, so
the one in use is named in DEFAULT_DATUM and can be swapped without touching
the maths. Run  python mk_proj.py  to print a point under every set.

No third-party packages.
"""

import math

# --- ellipsoids -------------------------------------------------------------
BESSEL = (6377397.155, 1 / 299.1528128)
WGS84 = (6378137.0, 1 / 298.257223563)

# --- projection (MK state grid, zone 7) -------------------------------------
K0 = 0.9999
LON0 = math.radians(21.0)
FALSE_EASTING = 7500000.0
FALSE_NORTHING = 0.0

# --- datum shifts: (dx, dy, dz, rx", ry", rz", scale_ppm) -------------------
DATUMS = {
    # PROJ's default towgs84 for EPSG:6316. Used unless told otherwise.
    "balkans": (682.0, -203.0, 480.0, 0, 0, 0, 0),
    # Published 7-parameter set for North Macedonia.
    "mk7": (521.756, -529.612, -756.408, -4.510, 4.883, -1.517, 5.279),
    # Neighbouring-country set, kept for comparison.
    "hrsi": (550.499, 164.116, 475.142, 0, 0, 0, 0),
    # Treat the grid as already geocentric-compatible (no shift).
    "none": (0, 0, 0, 0, 0, 0, 0),
}
DEFAULT_DATUM = "balkans"

# Sanity envelope for North Macedonia in the state grid.
X_RANGE = (7350000.0, 7700000.0)
Y_RANGE = (4520000.0, 4720000.0)
# ...and in WGS84.
LAT_RANGE = (40.75, 42.45)
LON_RANGE = (20.35, 23.10)


def _tm_inverse(easting, northing, ellipsoid):
    """Inverse transverse Mercator -> geodetic lat/lon on the same ellipsoid."""
    a, f = ellipsoid
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)

    x = easting - FALSE_EASTING
    y = northing - FALSE_NORTHING

    m = y / K0
    mu = m / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))

    phi = (mu
           + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu)
           + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu)
           + (151 * e1 ** 3 / 96) * math.sin(6 * mu)
           + (1097 * e1 ** 4 / 512) * math.sin(8 * mu))

    c1 = ep2 * math.cos(phi) ** 2
    t1 = math.tan(phi) ** 2
    n1 = a / math.sqrt(1 - e2 * math.sin(phi) ** 2)
    r1 = a * (1 - e2) / (1 - e2 * math.sin(phi) ** 2) ** 1.5
    d = x / (n1 * K0)

    lat = phi - (n1 * math.tan(phi) / r1) * (
        d ** 2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2)
        * d ** 6 / 720)
    lon = LON0 + (
        d - (1 + 2 * t1 + c1) * d ** 3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2)
        * d ** 5 / 120) / math.cos(phi)

    return math.degrees(lat), math.degrees(lon)


def _to_ecef(lat, lon, height, ellipsoid):
    a, f = ellipsoid
    lat, lon = math.radians(lat), math.radians(lon)
    e2 = f * (2 - f)
    n = a / math.sqrt(1 - e2 * math.sin(lat) ** 2)
    return ((n + height) * math.cos(lat) * math.cos(lon),
            (n + height) * math.cos(lat) * math.sin(lon),
            (n * (1 - e2) + height) * math.sin(lat))


def _to_geodetic(x, y, z, ellipsoid):
    a, f = ellipsoid
    e2 = f * (2 - f)
    lon = math.atan2(y, x)
    p = math.hypot(x, y)
    lat = math.atan2(z, p * (1 - e2))
    h = 0.0
    for _ in range(8):
        n = a / math.sqrt(1 - e2 * math.sin(lat) ** 2)
        h = p / math.cos(lat) - n
        lat = math.atan2(z, p * (1 - e2 * n / (n + h)))
    return math.degrees(lat), math.degrees(lon), h


def _helmert(x, y, z, params):
    dx, dy, dz, rx, ry, rz, ppm = params
    rx, ry, rz = (math.radians(v / 3600.0) for v in (rx, ry, rz))
    s = 1 + ppm / 1e6
    return (dx + s * (x - rz * y + ry * z),
            dy + s * (rz * x + y - rx * z),
            dz + s * (-ry * x + rx * y + z))


def to_wgs84(easting, northing, datum=DEFAULT_DATUM):
    """MK state-grid X/Y (metres) -> (lat, lon) in WGS84 degrees."""
    lat, lon = _tm_inverse(easting, northing, BESSEL)
    x, y, z = _to_ecef(lat, lon, 0.0, BESSEL)
    x, y, z = _helmert(x, y, z, DATUMS[datum])
    lat, lon, _ = _to_geodetic(x, y, z, WGS84)
    return round(lat, 7), round(lon, 7)


def plausible_grid(easting, northing):
    return (X_RANGE[0] <= easting <= X_RANGE[1]
            and Y_RANGE[0] <= northing <= Y_RANGE[1])


def plausible_wgs84(lat, lon):
    return (LAT_RANGE[0] <= lat <= LAT_RANGE[1]
            and LON_RANGE[0] <= lon <= LON_RANGE[1])


def haversine_m(lat1, lon1, lat2, lon2):
    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


if __name__ == "__main__":
    # Node 158 - Drzhavna granica RS/MK (Tabanovce), the A1 border crossing.
    sample = (7558480.48, 4677200.67)
    print("Node 158  X=%.2f  Y=%.2f\n" % sample)
    for name in DATUMS:
        print("  %-8s -> %.6f, %.6f" % ((name,) + to_wgs84(*sample, datum=name)))
