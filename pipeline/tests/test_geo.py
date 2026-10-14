"""Geography matching on small synthetic wards (no boundary files needed)."""

from civictrace.geo import Locator, Ward, canon, skeleton


def W(key, name, ac_no, ac):
    return Ward(key=key, ward_id=int(key.split("-")[1]), name=name, name_kn=None, corporation=key.split("-")[0],
                ac_no=ac_no, ac=ac, zone=None, population=1000, canon=canon(name))


WARDS = [
    W("East-1", "Hoodi", 174, "Mahadevapura"),
    W("East-2", "Dodda Nekkundi", 174, "Mahadevapura"),
    W("West-3", "Mathikere", 157, "Malleshwaram"),
    W("Central-4", "Halasuru", 162, "Shivajinagar"),
    W("West-5", "Peenya", 154, "Rajarajeshwarinagar"),
]
L = Locator(WARDS)


def test_division_names_map_to_constituency_with_spelling_variants():
    assert L.area_from_division("BBMP Pulikeshinagar East") == (159, "division_ac")
    assert L.area_from_division("BBMP K R Puram Mahadevapura") == (151, "division_ac")  # constituency first, zone second
    assert L.area_from_division("BWCC Mahalakshmilayout Division") == (156, "division_ac")
    assert L.area_from_division("BCCC Chikkapete Division") == (169, "division_ac")


def test_zone_wide_departments_are_not_pinned():
    for d in ("BBMP Mahadevapura Lakes", "BBMP Electrical West", "BBMP Project East", "BBMP Senior Assistant Director of Horticulture South"):
        assert L.area_from_division(d)[1] == "zonal"


def test_title_ward_spelling_tolerant_and_numbers_ignored():
    r = L.locate("BBMP Mahadevapura Division", "Providing allied work in Hoody ward no.98")
    assert r["ward_key"] == "East-1" and r["ac_no"] == 174


def test_sub_division_or_zone_is_not_a_ward():
    r = L.locate("BBMP Malleshwaram West", "Temporary control room for Mathikere Sub Division")
    assert r["ward_key"] is None and r["ac_no"] == 157


def test_locality_named_divisions():
    assert L.locate("BECC Doddanekkundi Division", "Road works")["ac_no"] == 174
    assert L.locate("BWCC Peenya Division", "Road works")["ac_no"] == 154


def test_conflicting_short_title_ward_keeps_division_area():
    # "Peenya" (short) named in a Shivajinagar division tender: keep the division's area, drop the ward
    r = L.locate("BBMP Shivajinagar East", "Supply of material from Peenya depot")
    assert r["ac_no"] == 162 and r["ward_key"] is None


def test_skeleton_ignores_spacing_and_vowels():
    assert skeleton("Dodda Nekkundi") == skeleton("Doddanekkundi")
