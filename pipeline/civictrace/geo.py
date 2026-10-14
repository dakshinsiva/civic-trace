"""Bengaluru geography: official boundaries and placing tenders on the map.

Boundaries (public domain, OpenCity / Greater Bengaluru Authority, Nov–Dec 2025):
369 wards with corporation, assembly constituency (AC), zone and 2011 census
population. Constituency "areas" are the wards dissolved by AC number.

How a tender is placed (deterministic and documented, never guessed):
1. Area: the KPPP division name is matched to one of the 28 Bengaluru assembly
   constituencies (BBMP engineering divisions are named after them), allowing
   for spelling variants. Divisions that work across a whole zone (lakes,
   electrical, horticulture, major roads, projects …) are NOT pinned to an area.
2. Locality: official ward names are matched against the tender title (and,
   for new-corporation divisions named after a locality, the division name)
   with a spelling-tolerant comparison. Ward NUMBERS in titles are ignored,
   because titles mix the 2010, 2023 and 2025 numbering schemes.
3. If the title's ward lies in a different constituency than the division,
   the ward wins only for long, unambiguous names; otherwise the division's
   area is kept and the ward is dropped.

A shared constituency is administrative geography only. It says nothing about
any elected representative.
"""

from __future__ import annotations

import csv
import json
import re
from dataclasses import dataclass
from pathlib import Path

from . import DATA_DIR

GEO_RAW = DATA_DIR / "geo" / "raw"

SOURCES = {
    "wards369.kml": "https://data.opencity.in/dataset/863209cb-4ced-4f51-b5c5-156939c50922/resource/9013d656-8051-4e2d-9648-46efd0d86d3d/download/gba-369-wards-december-2025.kml",
    "wards_divisions.csv": "https://data.opencity.in/dataset/863209cb-4ced-4f51-b5c5-156939c50922/resource/0b0b7da4-64e8-480c-bc2f-84c4ac86510e/download/gba-wards-divisions-mapping.csv",
    "corporations.kml": "https://data.opencity.in/dataset/3faa72e4-688f-4896-bfbb-0ee5a848bbd6/resource/06a9389c-8a3d-4a91-bf61-1df0dc7ffa28/download/790f6df1-45dc-4096-b4ed-53a4c3743d58.kml",
}
ATTRIBUTION = "Ward, constituency and corporation boundaries: Greater Bengaluru Authority delimitation 2025, via OpenCity (public domain)."

# Spelling variants seen in KPPP division names, keyed by assembly constituency number.
AC_ALIASES: dict[int, list[str]] = {
    150: ["yelahanka"],
    151: ["k r pura", "kr pura", "k r puram", "kr puram", "krishnarajapuram"],
    152: ["byatarayanapura"],
    153: ["yeshwanthapura", "yeshvanthapura", "yeshwanthpur", "yeshwantpur"],
    154: ["rajarajeshwarinagar", "rajarajeshwari nagar", "rajarajeshwari nagara", "rr nagar"],
    155: ["dasarahalli"],
    156: ["mahalakshmi layout", "mahalakshmipuram"],
    157: ["malleshwaram", "malleswaram"],
    158: ["hebbal", "hebbala"],
    159: ["pulakeshinagar", "pulikeshinagar", "pulakeshi nagar", "pulikeshinagara", "pulakeshinagara"],
    160: ["sarvagnanagar", "sarvagnanagara"],
    161: ["c v raman nagar", "cv raman nagar", "cv ramannagar", "c v ramannagar", "cv raman"],
    162: ["shivajinagar", "shivajinagara"],
    163: ["shanthinagar", "shantinagar", "shanthinagara"],
    164: ["gandhinagar", "gandhinagara"],
    165: ["rajajinagar", "rajajinagara"],
    166: ["govindraj nagar", "govindrajnagar", "govindarajanagar", "govindarajnagar"],
    167: ["vijayanagar", "vijayanagara", "vijaynagar"],
    168: ["chamarajpet", "chamrajapet", "chamarajpete", "chamarajapete", "chamrajpet"],
    169: ["chickpet", "chikpeth", "chikkapete", "chickpete", "chikpet"],
    170: ["basavanagudi", "basavangudi"],
    171: ["padmanabhanagar", "padmanabanagar", "padmanabhanagara", "padmanaba nagar"],
    172: ["btm", "b t m layout", "btm layout"],
    173: ["jayanagar", "jayanagara"],
    174: ["mahadevapura"],
    175: ["bommanahalli", "bomanahalli"],
    176: ["bengaluru south", "bangalore south"],
    177: ["anekal"],
}

# Divisions that operate across a zone or the city: never pinned to one area.
ZONAL = re.compile(
    r"\b(lakes?|swd|major roads|electrical|project|horticulture|forests?|mped|solid waste|tec|white ?topping|"
    r"transport|quality control|road infra|ri k100|co ordination|planning|climate|traffic|special division|"
    r"conservator|multi purpose|vehicle maintenance|zone|managing director|piu)\b"
)
# A place name followed by one of these words names a larger unit, not a ward.
NOT_WARD_AFTER = re.compile(r"^\s*(sub divi\w*|subdivi\w*|divi\w*|zon\w*|constituenc\w*|asembli\w*|asembl\w*|range|corporation|taluk\w*|hobli)")
PREFIX = re.compile(r"^(bbmp|bmbp|bccc|becc|bncc|bscc|bwcc|gba)\s+")


def norm(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def canon_token(t: str) -> str:
    """Spelling-tolerant key for one word (Kannada place names romanised many ways)."""
    for a, b in (("ee", "i"), ("oo", "u"), ("aa", "a"), ("th", "t"), ("dh", "d"), ("bh", "b"), ("kh", "k"),
                 ("sh", "s"), ("w", "v"), ("ou", "u"), ("ll", "l"), ("pp", "p"), ("kk", "k"), ("tt", "t"), ("nn", "n"),
                 ("dd", "d"), ("gg", "g"), ("mm", "m"), ("rr", "r"), ("ss", "s")):
        t = t.replace(a, b)
    t = re.sub(r"y$", "i", t)
    t = re.sub(r"(pet|pete)$", "pet", t)
    t = re.sub(r"[aue]$", "", t)
    return t


def skeleton(s: str) -> str:
    """Consonant skeleton of a whole name, spaces removed: 'Dodda Nekkundi' == 'Doddanekkundi'."""
    t = norm(s).replace(" ", "")
    for a, b in (("th", "t"), ("dh", "d"), ("bh", "b"), ("kh", "k"), ("sh", "s"), ("w", "v")):
        t = t.replace(a, b)
    t = re.sub(r"(.)\1+", r"\1", t)
    return t[:1] + re.sub(r"[aeiouy]", "", t[1:])


def canon(s: str) -> str:
    toks = [canon_token(t) for t in norm(s).split() if t not in {"ward", "no", "in", "at", "of", "the", "and"}]
    return " ".join(t for t in toks if t)


@dataclass
class Ward:
    key: str
    ward_id: int
    name: str
    name_kn: str | None
    corporation: str
    ac_no: int
    ac: str
    zone: str | None
    population: int | None
    canon: str
    geometry: object = None  # shapely geometry


def _polygonal(g):
    """Keep only polygon parts (make_valid can return collections with stray lines/points)."""
    from shapely.geometry import MultiPolygon, Polygon

    if isinstance(g, (Polygon, MultiPolygon)):
        return g
    parts = []
    for p in getattr(g, "geoms", []):
        if isinstance(p, Polygon):
            parts.append(p)
        elif isinstance(p, MultiPolygon):
            parts.extend(p.geoms)
    return MultiPolygon(parts)


def _kml_placemarks(path: Path):
    from defusedxml import ElementTree as ET  # downloaded file: parse defensively

    ns = {"k": "http://www.opengis.net/kml/2.2"}
    root = ET.parse(path).getroot()
    for pm in root.findall(".//k:Placemark", ns):
        data = {sd.get("name"): sd.text for sd in pm.findall(".//k:SimpleData", ns)}
        polys = []
        for poly in pm.findall(".//k:Polygon", ns):
            outer = poly.find(".//k:outerBoundaryIs//k:coordinates", ns)
            inners = poly.findall(".//k:innerBoundaryIs//k:coordinates", ns)
            if outer is None or not outer.text:
                continue
            polys.append((_coords(outer.text), [_coords(i.text) for i in inners if i.text]))
        yield data, polys


def _coords(text: str) -> list[tuple[float, float]]:
    out = []
    for tok in text.split():
        parts = tok.split(",")
        if len(parts) >= 2:
            out.append((float(parts[0]), float(parts[1])))
    return out


def load_wards(raw_dir: Path = GEO_RAW, with_geometry: bool = True) -> list[Ward]:
    from shapely.geometry import MultiPolygon, Polygon
    from shapely.validation import make_valid

    wards = []
    for d, polys in _kml_placemarks(raw_dir / "wards369.kml"):
        geom = None
        if with_geometry and polys:
            geom = _polygonal(make_valid(MultiPolygon([Polygon(o, i) for o, i in polys])))
        name = (d.get("ward_name") or "").strip()
        wards.append(
            Ward(
                key=f"{d['Corporation']}-{int(d['ward_id'])}",
                ward_id=int(d["ward_id"]),
                name=name,
                name_kn=d.get("ward_name_kn"),
                corporation=d["Corporation"],
                ac_no=int(d["ac_no"]),
                ac=d["ac"],
                zone=d.get("zone_name"),
                population=int(float(d["TOT_P"])) if d.get("TOT_P") else None,
                canon=canon(name),
                geometry=geom,
            )
        )
    return wards


class Locator:
    def __init__(self, wards: list[Ward]):
        self.wards = wards
        self.ac_name = {}
        for w in wards:
            self.ac_name.setdefault(w.ac_no, w.ac)
        # AC alias patterns (normalised, word-bounded), longest first
        self.ac_patterns = sorted(
            ((re.compile(r"\b" + re.escape(norm(a)) + r"\b"), ac, len(a)) for ac, al in AC_ALIASES.items() for a in al),
            key=lambda x: -x[2],
        )
        # Compact (no-space) canonical forms for division names like "Mahalakshmilayout"
        self.ac_compact = sorted(
            ((canon(a).replace(" ", ""), ac) for ac, al in AC_ALIASES.items() for a in al if len(a.replace(" ", "")) >= 6),
            key=lambda x: -len(x[0]),
        )
        self.ward_compact = sorted(
            ((w.canon.replace(" ", ""), w) for w in wards if len(w.canon.replace(" ", "")) >= 6), key=lambda x: -len(x[0])
        )
        # Ward name patterns on the canonical form; ignore very short names (too ambiguous)
        self.ward_patterns = []
        by_canon: dict[str, list[Ward]] = {}
        for w in wards:
            if len(w.canon.replace(" ", "")) >= 4:  # 3-letter keys (e.g. BHEL -> "bel") collide with words like "bell"
                by_canon.setdefault(w.canon, []).append(w)
        for c, ws in by_canon.items():
            self.ward_patterns.append((re.compile(r"\b" + re.escape(c) + r"\b"), ws, len(c)))
        self.ward_patterns.sort(key=lambda x: -x[2])

    def area_from_division(self, location_name: str | None) -> tuple[int | None, str]:
        n = PREFIX.sub("", norm(location_name or ""))
        if not n:
            return None, "none"
        if ZONAL.search(n):
            return None, "zonal"
        hits = []
        for pat, ac, _ in self.ac_patterns:
            m = pat.search(n)
            if m:
                hits.append((m.start(), ac))
        if hits:
            hits.sort()
            return hits[0][1], "division_ac"  # BBMP names put the constituency first, zone second
        compact = canon(n).replace(" ", "")
        for c, ac in self.ac_compact:
            if c in compact:
                return ac, "division_ac"
        return None, "unmatched"

    def wards_in(self, text: str | None, strict: bool = True) -> list[tuple[Ward, int]]:
        c = canon(text or "")
        found, taken = [], []
        for pat, ws, ln in self.ward_patterns:
            for m in pat.finditer(c):
                if any(m.start() < e and s < m.end() for s, e in taken):
                    continue  # overlaps a longer match already taken
                taken.append((m.start(), m.end()))
                if strict and NOT_WARD_AFTER.match(c[m.end():]):
                    continue  # "X sub division", "X zone": a larger unit, not the ward
                for w in ws:
                    found.append((w, ln))
        return found

    def locate(self, location_name: str | None, title: str | None) -> dict:
        ac, method = self.area_from_division(location_name)
        ward = None
        # Locality-named divisions of the new corporations (e.g. "BECC Horamavu Division")
        if ac is None and method in ("unmatched",):
            dname = PREFIX.sub("", norm(location_name or ""))
            dw = self.wards_in(dname, strict=False)
            acs = {w.ac_no for w, _ in dw}
            if not acs:  # exact token match, allowing short names such as "Peenya"
                toks = set(canon(dname).split())
                acs = {w.ac_no for w in self.wards if w.canon and w.canon in toks}
            if not acs:  # spacing/vowel variants: "Doddanekkundi" vs "Dodda Nekkundi"
                sk = skeleton(re.sub(r"\bdivision\b", "", dname))
                acs = {w.ac_no for w in self.wards if len(skeleton(w.name)) >= 5 and skeleton(w.name) in sk}
            if len(acs) == 1:
                ac, method = acs.pop(), "division_locality"
        tw = self.wards_in(title)
        if tw:
            distinct = {w.key: (w, ln) for w, ln in tw}
            if ac is not None:
                same = [v for v in distinct.values() if v[0].ac_no == ac]
                if len(same) == 1:
                    ward = same[0][0]
                elif not same and len(distinct) == 1:
                    w, ln = next(iter(distinct.values()))
                    if ln >= 9:  # long, distinctive name outweighs the division
                        ward, ac = w, w.ac_no
            elif len(distinct) == 1:
                ward = next(iter(distinct.values()))[0]
                ac = ward.ac_no
                method = "title_ward" if method in ("zonal", "unmatched", "none") else method
        return {
            "ac_no": ac,
            "ward_key": ward.key if ward else None,
            "geo_method": ("title_ward+" + method) if ward else method,
        }


# ---------------------------------------------------------------- assets for the web map

def build_geo_assets(out_dir: Path, raw_dir: Path = GEO_RAW, tolerance: float = 0.00015) -> dict:
    from shapely.geometry import mapping
    from shapely.ops import unary_union

    wards = load_wards(raw_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    def feat(geom, props):
        g = mapping(_polygonal(geom.simplify(tolerance, preserve_topology=True)))
        return {"type": "Feature", "properties": props, "geometry": _round(g)}

    ward_feats = []
    for w in wards:
        c = w.geometry.representative_point()
        ward_feats.append(
            feat(
                w.geometry,
                {
                    "key": w.key, "name": w.name, "name_kn": w.name_kn, "corporation": w.corporation,
                    "ac_no": w.ac_no, "ac": w.ac, "population": w.population,
                    "cx": round(c.x, 5), "cy": round(c.y, 5),
                },
            )
        )
    areas = {}
    for w in wards:
        areas.setdefault(w.ac_no, []).append(w)
    area_feats = []
    for ac, ws in sorted(areas.items()):
        geom = unary_union([w.geometry for w in ws])
        c = geom.representative_point()
        corps = sorted({w.corporation for w in ws})
        area_feats.append(
            feat(
                geom,
                {
                    "ac_no": ac, "name": ws[0].ac, "corporations": corps,
                    "population": sum(w.population or 0 for w in ws), "wards": len(ws),
                    "cx": round(c.x, 5), "cy": round(c.y, 5),
                },
            )
        )
    corps = {}
    for w in wards:
        corps.setdefault(w.corporation, []).append(w.geometry)
    corp_feats = [feat(unary_union(gs), {"corporation": k}) for k, gs in sorted(corps.items())]
    for name, feats in (("wards", ward_feats), ("areas", area_feats), ("corporations", corp_feats)):
        (out_dir / f"{name}.geojson").write_text(
            json.dumps({"type": "FeatureCollection", "attribution": ATTRIBUTION, "features": feats}, separators=(",", ":"))
        )
    return {"wards": len(ward_feats), "areas": len(area_feats), "corporations": len(corp_feats)}


def _round(g, nd: int = 5):
    def r(c):
        if isinstance(c, (list, tuple)) and c and isinstance(c[0], (int, float)):
            return [round(c[0], nd), round(c[1], nd)]
        return [r(x) for x in c]

    return {"type": g["type"], "coordinates": r(g["coordinates"])}


def load_division_table(raw_dir: Path = GEO_RAW) -> list[dict]:
    """Official 2025 ward → division → sub-division mapping (forward-filled)."""
    rows, last = [], {}
    with open(raw_dir / "wards_divisions.csv", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            for k in ("Corporation", "Zone", "Division", "Sub-division"):
                if r.get(k):
                    last[k] = r[k]
                else:
                    r[k] = last.get(k)
            rows.append(r)
    return rows
