"""Placing contracts at named OpenStreetMap places: only safe, unambiguous matches inside the tender's area."""

import json

from shapely.geometry import box

from civictrace.geo import Ward, canon
from civictrace.sites import Feature, SiteLocator, core_phrase, full_phrase, load_features, skel_phrase


def ward(key, ac_no, x0, y0, x1, y1):
    return Ward(key=key, ward_id=1, name=key, name_kn=None, corporation="South", ac_no=ac_no, ac=f"AC{ac_no}", zone=None,
                population=1000, canon=canon(key), geometry=box(x0, y0, x1, y1))


# Two wards side by side in one constituency (lon 77.50–77.52 and 77.52–77.54, lat 12.90–12.92), a third elsewhere.
WARDS = [ward("South-1", 175, 77.50, 12.90, 77.52, 12.92), ward("South-2", 175, 77.52, 12.90, 77.54, 12.92),
         ward("South-3", 173, 77.60, 12.95, 77.62, 12.97)]


def feat(name, kind, lon, lat):
    return Feature(name=name, kind=kind, lat=lat, lon=lon, core=core_phrase(name), full=full_phrase(name), skel=skel_phrase(name))


def locator(*features):
    return SiteLocator.build([f for f in features if f.core], WARDS)


def test_named_lake_in_the_tenders_ward_is_placed_exactly():
    loc = locator(feat("Puttenahalli Lake", "lake", 77.505, 12.905))
    s = loc.locate("Annual Maintenance of Puttenahalli Lake", "South-1", 175)
    assert s and (s.lat, s.lon) == (12.905, 77.505) and s.name == "Puttenahalli Lake" and s.kind == "lake"


def test_title_must_say_what_kind_of_place_it_is():
    loc = locator(feat("Puttenahalli Lake", "lake", 77.505, 12.905))
    assert loc.locate("Improvements to drains in Puttenahalli", "South-1", 175) is None


def test_generic_names_are_never_matched():
    assert core_phrase("Main Road") is None
    assert core_phrase("1st Cross Road") is None
    assert core_phrase("Government Primary School") is None
    assert core_phrase("Kanakapura Road") is not None


def test_a_place_in_another_ward_is_not_used():
    loc = locator(feat("Puttenahalli Lake", "lake", 77.53, 12.91))  # in South-2
    assert loc.locate("Desilting of Puttenahalli Lake", "South-1", 175) is None


def test_constituency_used_when_no_ward_is_named():
    loc = locator(feat("Puttenahalli Lake", "lake", 77.53, 12.91))  # South-2, same constituency 175
    s = loc.locate("Desilting of Puttenahalli Lake", None, 175)
    assert s and s.ward_key == "South-2"


def test_a_named_site_wins_over_a_road_in_the_same_title():
    loc = locator(feat("Kanakapura Road", "road", 77.51, 12.91), feat("Sarakki Lake", "lake", 77.515, 12.915))
    s = loc.locate("Asphalting of Kanakapura Road near Sarakki Lake", "South-1", 175)
    assert s and s.name == "Sarakki Lake"


def test_same_named_places_far_apart_are_left_approximate():
    loc = locator(feat("Ganesha Temple", "worship", 77.501, 12.901), feat("Ganesha Temple", "worship", 77.519, 12.919))
    assert loc.locate("Repairs to Ganesha Temple compound wall", "South-1", 175) is None


def test_lake_named_by_a_zone_wide_division_is_found_citywide():
    loc = locator(feat("Arekere Lake", "lake", 77.61, 12.96))  # in South-3
    s = loc.locate("Annual Maintenance of Arekere Lake", None, None)
    assert s and s.ward_key == "South-3" and s.ac_no == 173


def test_first_place_named_is_used_and_the_rest_counted():
    loc = locator(feat("Arekere Lake", "lake", 77.505, 12.905), feat("Puttenahalli Lake", "lake", 77.515, 12.915))
    s = loc.locate("Annual Maintenance of Arekere Lake & Puttenahalli Lake", "South-1", 175)
    assert s and s.name == "Arekere Lake" and s.others == 1


def test_overpass_json_is_loaded_with_centres(tmp_path):
    p = tmp_path / "osm.json"
    p.write_text(json.dumps({"elements": [
        {"type": "way", "center": {"lat": 12.905, "lon": 77.505}, "tags": {"name": "Puttenahalli Lake", "natural": "water"}},
        {"type": "node", "lat": 12.91, "lon": 77.51, "tags": {"name": "Main Road", "highway": "residential"}},
        {"type": "node", "lat": 12.91, "lon": 77.51, "tags": {"highway": "residential"}},
    ]}))
    fs = load_features(p)
    assert [(f.name, f.kind) for f in fs] == [("Puttenahalli Lake", "lake")]


def test_a_ward_name_and_the_word_road_do_not_make_a_road_match():
    # Seen in real data: the ward is named Nagawara and the title says "Road and drain", but the work is elsewhere.
    loc = locator(feat("Nagawara Main Road", "road", 77.51, 12.91), feat("Garudacharpalya Lake", "lake", 77.512, 12.912))
    assert loc.locate("Comprehensive Development of Road and drain at Karamachand Layout in Nagawara Ward No-49", "South-1", 175) is None
    assert loc.locate("Temporary immersion tank for Ganesha idols in ward no 100 Garudacharpalya", "South-1", 175) is None
    # ...but naming the road itself does
    s = loc.locate("Asphalting of Nagawara Main Road from the bus stop to the lake", "South-1", 175)
    assert s and s.name == "Nagawara Main Road"


def test_places_named_like_a_ward_are_not_matched():
    wards = WARDS + [ward("Banashankari Temple Ward", 172, 77.56, 12.92, 77.58, 12.94)]
    loc = SiteLocator.build([feat("Banashankari Temple", "worship", 77.57, 12.93)], wards)
    assert loc.locate("Maintenance of roads and drains in Ward No-180 Banashankari Temple Ward", "Banashankari Temple Ward", 172) is None


def test_old_ward_names_written_after_ward_no_are_not_places():
    loc = locator(feat("Dattatreya Temple", "worship", 77.51, 12.91), feat("Silver Jubilee Park", "park", 77.512, 12.912))
    assert loc.locate("Filling of Potholes in New Ward No-122-Dattatreya Temple, 123-Gandhinagara", "South-1", 175) is None
    assert loc.locate("Roads and drains in Hanumanthanagara and surrounding area in ward no. 161 Silver jubilee Park", "South-1", 175) is None
    assert loc.locate("Repairs to the compound wall of Dattatreya Temple", "South-1", 175) is not None


def test_a_station_needs_the_word_station_next_to_its_name():
    loc = locator(feat("Nayandahalli", "station", 77.51, 12.91))
    assert loc.locate("Facilities for block 60 Metro Layout and Nayandahalli Grama", "South-1", 175) is None
    s = loc.locate("Footpath works near Nayandahalli metro station", "South-1", 175)
    assert s and s.kind == "station"


def test_spelling_differences_in_long_names_still_match():
    # OpenStreetMap spells the J.P Nagar lake "Puttenhalli"; tenders write "Puttenahalli".
    loc = locator(feat("Puttenhalli Lake", "lake", 77.505, 12.905))
    s = loc.locate("Annual Maintenance of Puttenahalli Lake", "South-1", 175)
    assert s and s.name == "Puttenhalli Lake"
    # ...but only as a phrase: the name and "lake" far apart do not match
    assert loc.locate("Fencing at Puttenahalli park near the lake bund", "South-1", 175) is None


def test_respelled_names_keep_their_place_in_the_title_order():
    loc = locator(feat("Bhoganahalli Lake", "lake", 77.505, 12.905), feat("Deverabisanahalli Lake", "lake", 77.515, 12.915))
    s = loc.locate("Annual Maintenance of Bhoganahalli Lake, Panathur lake and Devarabeesanahalli Lake", "South-1", 175)
    assert s and s.name == "Bhoganahalli Lake" and s.others == 1


def test_respelled_ward_names_are_not_places():
    loc = locator(feat("Silver Jubilee Park", "park", 77.51, 12.91))
    assert loc.locate("Maintenance of Horticulture Works in Silver Jublee Park Ward Parks (Ward No 161)", "South-1", 175) is None


def test_flyovers_and_bridges_are_not_names():
    assert core_phrase("Flyover") is None
    loc = locator(feat("Flyover", "road", 77.51, 12.91))
    assert loc.locate("Improvements to roads at Babusapalya Flower garden Main Road", "South-1", 175) is None


def test_bracketed_asides_do_not_split_a_name():
    loc = locator(feat("Puttenhalli Lake", "lake", 77.505, 12.905))
    s = loc.locate("Annual Maintenance of Arekere Lake & Puttenahalli (next to brigade millenium) Lake", "South-1", 175)
    assert s and s.name == "Puttenhalli Lake"
    # names inside the brackets still count
    loc = locator(feat("Akshaynagar Lake", "lake", 77.505, 12.905))
    assert loc.locate("Chainlink fencing to Nyanappanahalli (Akshayanagara) Lake", "South-1", 175)


def test_respellings_are_not_trusted_city_wide():
    loc = locator(feat("Mallasandra Lake", "lake", 77.61, 12.96))
    assert loc.locate("Annual Maintenance of Mylasandra lake", None, None) is None


def test_tank_kere_and_lake_are_the_same_word():
    loc = locator(feat("Mylasandra Tank", "lake", 77.61, 12.96))
    s = loc.locate("Chainlink fencing at Mylasandra (Sunnakallu palya) lake", None, None)
    assert s and s.name == "Mylasandra Tank"
