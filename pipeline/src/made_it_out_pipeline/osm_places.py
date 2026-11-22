"""Download hangout spots in Greater Boston from OpenStreetMap (Overpass API).

Yelp's open dataset has no Boston businesses, so OSM is the source of real
Boston places. Output is one JSON object per line:

    {"osm_id": "node/123", "name": "Lucky Strike", "category": "bowling_alley",
     "kind": "leisure", "cuisine": null, "lat": 42.34, "lon": -71.09,
     "address": "145 Ipswich St, Boston", "website": "..."}

Usage:
    python3 -m made_it_out_pipeline.osm_places \
        --raw ../data/raw/osm/boston_overpass.json \
        --out ../data/processed/boston_places.jsonl

Pass --from-raw to re-normalize a saved download without hitting the API.
"""

from __future__ import annotations

import argparse
import json
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Any, Iterable, Iterator

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "made-it-out-pipeline/0.1"

# Boston, Cambridge, Somerville, Brookline and nearby (south, west, north, east).
DEFAULT_BBOX = (42.227, -71.191, 42.420, -70.986)

# OSM tag key -> values that count as "things to do with friends".
# Order matters: the first matching key sets the category, so the specific
# "sport" tag (e.g. climbing) wins over a generic leisure=sports_centre.
HANGOUT_TAGS: dict[str, list[str]] = {
    "sport": ["climbing", "billiards", "axe_throwing", "golf", "skateboard"],
    "amenity": [
        "restaurant",
        "cafe",
        "bar",
        "pub",
        "biergarten",
        "fast_food",
        "food_court",
        "ice_cream",
        "cinema",
        "theatre",
        "arts_centre",
        "nightclub",
        "karaoke_box",
        "music_venue",
        "planetarium",
        "community_centre",
    ],
    "leisure": [
        "bowling_alley",
        "escape_game",
        "amusement_arcade",
        "miniature_golf",
        "ice_rink",
        "sports_centre",
        "water_park",
        "trampoline_park",
        "dance",
        "park",
        "garden",
        "beach_resort",
        "hackerspace",
    ],
    "tourism": ["museum", "gallery", "attraction", "zoo", "aquarium", "viewpoint", "theme_park"],
    "shop": ["books", "games", "music", "board_games", "comics"],
}


def build_query(bbox: tuple[float, float, float, float], timeout: int = 180) -> str:
    s, w, n, e = bbox
    box = f"({s},{w},{n},{e})"
    parts = []
    for key, values in HANGOUT_TAGS.items():
        regex = "^(" + "|".join(values) + ")$"
        parts.append(f'nwr["{key}"~"{regex}"]["name"]{box};')
    return f"[out:json][timeout:{timeout}];(" + "".join(parts) + ");out center tags;"


def fetch(query: str, url: str = OVERPASS_URL) -> dict[str, Any]:
    data = urllib.parse.urlencode({"data": query}).encode()
    req = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.load(resp)


def _address(tags: dict[str, str]) -> str | None:
    street = " ".join(x for x in (tags.get("addr:housenumber"), tags.get("addr:street")) if x)
    parts = [p for p in (street, tags.get("addr:city")) if p]
    return ", ".join(parts) or None


def normalize(elements: Iterable[dict[str, Any]]) -> Iterator[dict[str, Any]]:
    """Turn raw Overpass elements into flat place records (one per OSM object)."""
    seen = set()
    for el in elements:
        tags = el.get("tags") or {}
        name = tags.get("name")
        osm_id = f"{el.get('type')}/{el.get('id')}"
        if not name or osm_id in seen:
            continue
        lat = el.get("lat", (el.get("center") or {}).get("lat"))
        lon = el.get("lon", (el.get("center") or {}).get("lon"))
        if lat is None or lon is None:
            continue
        kind = category = None
        for key, values in HANGOUT_TAGS.items():
            value = tags.get(key)
            if value in values:
                kind, category = key, value
                break
        if category is None:
            continue
        seen.add(osm_id)
        yield {
            "osm_id": osm_id,
            "name": name,
            "category": category,
            "kind": kind,
            "cuisine": tags.get("cuisine"),
            "lat": lat,
            "lon": lon,
            "address": _address(tags),
            "website": tags.get("website") or tags.get("contact:website"),
        }


def main(argv: list | None = None) -> None:
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("--raw", type=Path, default=Path("../data/raw/osm/boston_overpass.json"))
    p.add_argument("--out", type=Path, default=Path("../data/processed/boston_places.jsonl"))
    p.add_argument("--from-raw", action="store_true", help="Skip download, reuse --raw")
    p.add_argument(
        "--bbox", type=float, nargs=4, default=DEFAULT_BBOX, metavar=("S", "W", "N", "E")
    )
    args = p.parse_args(argv)

    if args.from_raw:
        raw = json.loads(args.raw.read_text())
    else:
        raw = fetch(build_query(tuple(args.bbox)))
        args.raw.parent.mkdir(parents=True, exist_ok=True)
        args.raw.write_text(json.dumps(raw))

    places = list(normalize(raw.get("elements", [])))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as f:
        for place in places:
            f.write(json.dumps(place, ensure_ascii=False) + "\n")

    print(f"wrote {len(places)} places to {args.out}")
    for cat, n in Counter(pl["category"] for pl in places).most_common(15):
        print(f"  {cat:20} {n}")


if __name__ == "__main__":
    main()
