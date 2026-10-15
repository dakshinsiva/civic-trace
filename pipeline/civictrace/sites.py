"""Placing contracts at the named place they are about, using OpenStreetMap.

KPPP publishes no worksite coordinates: in the archive only 1 tender in about 9,400 has them, and its
"work location" entries are mostly office addresses. Many titles do name the place the work is at,
though: "Annual Maintenance of Puttenahalli Lake", "Asphalting of Hennur Bagalur Road". This module
matches those names against OpenStreetMap features and accepts a match only when it is safe:

* the feature lies inside the tender's own ward, or its constituency area when no ward is named
  (lakes, parks, burial grounds and stations are also tried city-wide when the tender has no area,
  because zone-wide divisions such as "South Lakes" name them but cannot be placed otherwise);
* the title says what kind of place it is ("lake", "park", "road" ...), not just a matching word;
* the feature's full name ("Puttenahalli Lake", "Hennur Bagalur Road") appears in the title as a
  phrase, and what is left without generic words ("main", "cross", "park") is long enough to mean
  something: a title that only mentions the Puttenahalli ward and "roads" does not match a road;
* the name is not also a ward or constituency name ("Banashankari Temple" is a ward), since titles
  use those to say which ward the work is in;
* the title does not use the name as a ward's name ("Ward No 61 Radhakrishna Temple", including the
  pre-2025 ward names), and a station only counts when the title says "station", "bus stand" or
  similar right after its name;
* the name picks out one place: if same-named features are far apart in the search region, the
  tender is left approximate rather than guessed.

When a title names several places, the first one named is used. Roads are a fallback: a named
lake, park or building wins over a road in the same title. Everything not matched stays where it
was: placed within its ward, and shown as approximate.

Map data © OpenStreetMap contributors, available under the Open Database Licence (ODbL).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from .geo import GEO_RAW, canon, norm, skeleton

# The main Overpass server, then public mirrors (the main one is often busy).
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
OSM_RAW = GEO_RAW / "osm-places.json"
ATTRIBUTION = "Places: © OpenStreetMap contributors (ODbL)"

# Greater Bengaluru, south,west,north,east
BBOX = "12.78,77.38,13.20,77.88"
QUERY = f"""[out:json][timeout:240];
(
  nwr["name"]["natural"="water"]({BBOX});
  nwr["name"]["water"]({BBOX});
  nwr["name"]["landuse"="reservoir"]({BBOX});
  nwr["name"]["leisure"~"^(park|garden|playground|stadium|sports_centre|pitch)$"]({BBOX});
  way["name"]["highway"~"^(trunk|primary|secondary|tertiary|unclassified|residential|living_street)$"]({BBOX});
  nwr["name"]["amenity"~"^(school|college|hospital|clinic|marketplace|bus_station|place_of_worship|library|community_centre|townhall|crematorium|grave_yard)$"]({BBOX});
  nwr["name"]["landuse"="cemetery"]({BBOX});
  nwr["name"]["railway"~"^(station|halt)$"]({BBOX});
  nwr["name"]["public_transport"="station"]({BBOX});
  nwr["name"]["junction"]({BBOX});
  node["name"]["highway"="traffic_signals"]({BBOX});
);
out center tags;"""

# What the title must say for a feature of each kind to count.
KIND_WORDS = {
    "lake": r"\b(lake|lakes|kere|tank)\b",
    "park": r"\b(park|parks|garden|gardens|playground|play ground|udyana|stadium|ground)\b",
    "school": r"\b(school|schools|shaale|college)\b",
    "hospital": r"\b(hospital|health cent\w*|clinic|phc|uphc|dispensary|maternity)\b",
    "worship": r"\b(temple|church|mosque|masjid|dargah|gudi)\b",
    "station": r"\b(metro|station|bus stand|bus stop|bus depot|depot)\b",
    "burial": r"\b(burial|crematorium|cemetery|graveyard|grave yard|smashana|rudrabhoomi|chitagara)\b",
    "junction": r"\b(junction|circle|signal)\b",
    "market": r"\b(market|santhe|mandi)\b",
    "library": r"\b(library|community hall|community centre|town hall)\b",
    "road": r"\b(road|roads|rd|street|marga|marg|highway)\b",
}
SITE_KINDS = [k for k in KIND_WORDS if k != "road"]
CITYWIDE_KINDS = {"lake", "park", "burial", "station"}

# Words that do not identify a place on their own.
GENERIC = set(
    """lake lakes kere tank park parks garden gardens playground ground stadium pitch road roads rd street main cross
    ring outer inner service link new old the of and a sri shri sree temple school schools government govt primary
    high higher model hospital ward no phase stage block sector layout nagar nagara colony extension bus stop station
    stand metro circle junction signal market church masjid mosque burial crematorium cemetery graveyard hindu muslim
    christian public bbmp bda gba college community centre center hall library first second third fourth fifth
    north south east west upper lower big small cross road main road 1st 2nd 3rd 4th 5th 6th 7th 8th 9th 10th
    children childrens play gym open air bengaluru bangalore city central immersion temporary flyover fly over
    underpass bridge subway skywalk railway parallel""".split()
)
GENERIC_CANON = {canon(g) for g in GENERIC} | GENERIC
# Same-named features further apart than this (in degrees, about 1 km) are treated as different places.
SPREAD = 0.009


def kind_of(tags: dict) -> str | None:
    """The kind of place an OSM feature is, for matching against title words."""
    if tags.get("natural") == "water" or "water" in tags or tags.get("landuse") == "reservoir":
        return "lake"
    if tags.get("leisure") in {"park", "garden", "playground", "stadium", "sports_centre", "pitch"}:
        return "park"
    a = tags.get("amenity")
    if a in {"school", "college"}:
        return "school"
    if a in {"hospital", "clinic"}:
        return "hospital"
    if a == "place_of_worship":
        return "worship"
    if a in {"crematorium", "grave_yard"} or tags.get("landuse") == "cemetery":
        return "burial"
    if a == "marketplace":
        return "market"
    if a in {"library", "community_centre", "townhall"}:
        return "library"
    if a == "bus_station" or tags.get("railway") in {"station", "halt"} or tags.get("public_transport") == "station":
        return "station"
    if "junction" in tags or tags.get("highway") == "traffic_signals":
        return "junction"
    if "highway" in tags:
        return "road"
    return None


def core_phrase(name: str) -> str | None:
    """The distinctive part of a place name, spelling-normalised: "Puttenahalli Lake" -> "putenahali".

    None when nothing distinctive is left ("Main Road", "1st Cross", "Ganesha Temple" keeps "ganesa").
    """
    toks = [t for t in canon(name).split() if t not in GENERIC_CANON and not t.isdigit() and not re.fullmatch(r"\d+(st|nd|rd|th)", t)]
    if not toks or max(len(t) for t in toks) < 4:
        return None
    return " ".join(toks)


HONORIFICS = re.compile(r"^(sri|shri|sree|shree|st|saint|the)\s+")


def _same_words(t: str) -> str:
    """Words that mean the same in place names, on normalised text: Bengaluru's lakes are "tank", "kere" or "lake"."""
    return re.sub(r"\b(tank|kere)\b", "lake", re.sub(r"\brd\b", "road", t))


def skel_phrase(text: str) -> str:
    """Word-by-word consonant skeleton, for spellings that differ in vowels or doubled letters:
    "Puttenahalli Lake" and "Puttenhalli Lake" both give "ptnhl lk"."""
    return " ".join(skeleton(w) for w in _same_words(norm(HONORIFICS.sub("", norm(text)))).split())


def full_phrase(name: str) -> str:
    """The whole name, spelling-normalised and without a leading honorific: "Sri Rama Temple" -> "rama templ"."""
    return canon(HONORIFICS.sub("", _same_words(norm(name))))


def _named_as_ward(name: str, plain: str, skel: str = "", skel_text: str = "") -> bool:
    """True when the title uses the name as a ward's name: "ward no 61 radhakrishna temple", "... temple ward",
    in any spelling ("Silver Jublee Park Ward" for Silver Jubilee Park)."""
    n = re.escape(norm(HONORIFICS.sub("", norm(name))))
    if re.search(rf" ward (no )?\d+ (\w+ )?{n} | {n} ward ", plain):
        return True
    k = re.escape(skel)
    return bool(skel and re.search(rf" vrd (n )?\d+ (\w+ )?{k} | {k} vrd ", skel_text))


def _says_station(name: str, plain: str) -> bool:
    """A station counts only when the title says so right after its name: "Majestic bus stand", "... metro station"."""
    n = re.escape(norm(name))
    return bool(re.search(rf" {n}( \w+){{0,2}} (metro|station|bus stand|bus stop|bus station|depot)", plain))


@dataclass
class Feature:
    name: str
    kind: str
    lat: float
    lon: float
    core: str
    full: str = ""
    skel: str = ""
    ward_key: str | None = None
    ac_no: int | None = None


@dataclass
class Site:
    lat: float
    lon: float
    name: str
    kind: str
    ward_key: str | None
    ac_no: int | None
    others: int = 0  # further distinct places named in the same title


def load_features(path: Path = OSM_RAW) -> list[Feature]:
    data = json.loads(path.read_text())
    out = []
    for el in data.get("elements", []):
        tags = el.get("tags") or {}
        name = tags.get("name:en") or tags.get("name")
        kind = kind_of(tags)
        lat = el.get("lat", (el.get("center") or {}).get("lat"))
        lon = el.get("lon", (el.get("center") or {}).get("lon"))
        if not name or not kind or lat is None or lon is None:
            continue
        core = core_phrase(name)
        if core:
            out.append(Feature(name=name, kind=kind, lat=float(lat), lon=float(lon), core=core, full=full_phrase(name), skel=skel_phrase(name)))
    return out


@dataclass
class SiteLocator:
    """Index of named OSM features by ward and by constituency area."""

    features: list[Feature]
    by_ward: dict[str, list[Feature]] = field(default_factory=dict)
    by_area: dict[int, list[Feature]] = field(default_factory=dict)
    citywide: list[Feature] = field(default_factory=list)

    @classmethod
    def build(cls, features: list[Feature], wards: list) -> "SiteLocator":
        """Assign each feature to the ward polygon it falls in (wards loaded with geometry)."""
        from shapely.geometry import Point
        from shapely.strtree import STRtree

        polys = [w.geometry for w in wards]
        tree = STRtree(polys)
        # A place named exactly like a ward or constituency ("Banashankari Temple", "Bommanahalli") is how titles
        # name the ward, not the place, so it is never matched.
        place_names = {w.canon for w in wards} | {canon(w.ac) for w in wards}
        features = [f for f in features if (f.full or f.core) not in place_names]
        loc = cls(features)
        for f in features:
            pt = Point(f.lon, f.lat)
            for i in tree.query(pt):
                if polys[int(i)].contains(pt):
                    w = wards[int(i)]
                    f.ward_key, f.ac_no = w.key, w.ac_no
                    loc.by_ward.setdefault(w.key, []).append(f)
                    loc.by_area.setdefault(w.ac_no, []).append(f)
                    break
            if f.kind in CITYWIDE_KINDS and f.ward_key:
                loc.citywide.append(f)
        return loc

    def locate(self, title: str | None, ward_key: str | None, ac_no: int | None) -> Site | None:
        if not title:
            return None
        if ward_key:
            pool = self.by_ward.get(ward_key, [])
        elif ac_no is not None:
            pool = self.by_area.get(int(ac_no), [])
        else:
            pool = self.citywide
        if not pool:
            return None
        if "(" in title:
            # Also read the title without bracketed asides: "Puttenahalli (next to brigade millenium) Lake".
            # The separator keeps phrases from running across the two copies.
            title = f"{title} xxsepxx {re.sub(r'\([^)]*\)?', ' ', title)}"
        text = " " + canon(_same_words(norm(title))) + " "
        low = title.lower()
        plain = " " + norm(title) + " "
        skel_text = " " + skel_phrase(title) + " "
        kinds_named = {k for k, rx in KIND_WORDS.items() if re.search(rx, low)}
        if not kinds_named:
            return None
        # Every feature whose distinctive name appears in the title, for a kind the title mentions.
        hits: dict[tuple[str, str], list[Feature]] = {}
        for f in pool:
            if f.kind not in kinds_named:
                continue
            full = f.full or f.core
            # Exact (spelling-normalised) phrase, or for long distinctive names the vowel-free skeleton.
            # A respelled match is only trusted inside the tender's ward or area: city-wide, names that differ only in
            # vowels are often different places ("Mylasandra" in the south-west, "Mallasandra" in the north).
            named = f" {full} " in text or (
                pool is not self.citywide and len(f.core.replace(" ", "")) >= 6 and f.skel and f" {f.skel} " in skel_text
            )
            if named and not _named_as_ward(f.name, plain, f.skel, skel_text) and (f.kind != "station" or _says_station(f.name, plain)):
                # Spelling variants of one name ("Hormavu", "Horamavu") are one place.
                hits.setdefault((f.kind, f.skel or full), []).append(f)
        if not hits:
            return None
        # One place per (kind, name): reject names that point at places far apart.
        places = []
        for (kind, core), fs in hits.items():
            lats = [f.lat for f in fs]
            lons = [f.lon for f in fs]
            if max(lats) - min(lats) > SPREAD or max(lons) - min(lons) > SPREAD:
                if kind != "road":
                    continue
                # A long road: keep the segments near the middle of the stretch in this region.
            mid_lat, mid_lon = sum(lats) / len(lats), sum(lons) / len(lons)
            best = min(fs, key=lambda f: (f.lat - mid_lat) ** 2 + (f.lon - mid_lon) ** 2)
            # Where the name comes in the title, counted in words so exact and respelled matches compare.
            at = skel_text.find(f" {core} ")
            pos = skel_text[:at].count(" ") if at >= 0 else text[: max(text.find(f" {best.full or best.core} "), 0)].count(" ")
            places.append((pos, kind, best, core))
        if not places:
            return None
        sites = [p for p in places if p[1] != "road"] or places
        # A name inside a longer matched name is part of it: "Ganesha Temple" in "Ganesha Temple Road".
        everything = places
        sites = [p for p in sites if not any(p[3] != q[3] and f" {p[3]} " in f" {q[3]} " for q in everything)] or sites
        sites.sort(key=lambda p: p[0])
        _, kind, f, _ = sites[0]
        distinct = {p[3] for p in sites}
        return Site(lat=f.lat, lon=f.lon, name=f.name, kind=kind, ward_key=f.ward_key, ac_no=f.ac_no, others=len(distinct) - 1)
