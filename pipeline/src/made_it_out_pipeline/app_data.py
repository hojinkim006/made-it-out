"""Build the place, event and rarity data the web app loads.

Joins the three datasets:
  * OpenStreetMap (data/processed/boston_places.jsonl): real Boston places.
  * Yelp business file: how common each kind of place is nationally.
  * Boston special event licenses CSV: one-off local events.

Place rarity (0..1) blends national and local rarity:
    rarity = 0.6 * yelp_rarity + 0.4 * boston_rarity   (x0.8 for food/coffee places)
where rarity = 1 - log(1 + count) / log(1 + max_count). Restaurants use their
cuisine (ramen, sushi...) when OSM knows it.

Event rarity: one-off events are rare by nature, so
    rarity = 0.65 + 0.35 * rarity_of_event_type_among_boston_events

Writes to web/public/data/: places.json, events.json, rarity.json.

Usage (from pipeline/):
    python3 -m made_it_out_pipeline.app_data
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
from collections import Counter
from datetime import date, timedelta
from pathlib import Path
from typing import Iterable

YELP_WEIGHT = 0.6
LOCAL_WEIGHT = 0.4
EVENT_BASE = 0.65
# A rare cuisine is still "going out to eat": damp food/coffee so activities rank higher.
DINING_DAMPING = 0.8

# OSM category -> (app category, Yelp category used for national rarity)
OSM_TO_APP: dict[str, tuple[str, str]] = {
    "restaurant": ("food", "Restaurants"),
    "fast_food": ("food", "Fast Food"),
    "food_court": ("food", "Food Court"),
    "ice_cream": ("food", "Ice Cream & Frozen Yogurt"),
    "cafe": ("coffee", "Coffee & Tea"),
    "bar": ("music", "Bars"),
    "pub": ("music", "Pubs"),
    "biergarten": ("music", "Beer Gardens"),
    "nightclub": ("music", "Dance Clubs"),
    "music_venue": ("music", "Music Venues"),
    "karaoke_box": ("music", "Karaoke"),
    "music": ("music", "Vinyl Records"),
    "dance": ("music", "Dance Studios"),
    "park": ("outdoors", "Parks"),
    "garden": ("outdoors", "Botanical Gardens"),
    "viewpoint": ("outdoors", "Hiking"),
    "zoo": ("outdoors", "Zoos"),
    "aquarium": ("water", "Aquariums"),
    "museum": ("art", "Museums"),
    "gallery": ("art", "Art Galleries"),
    "arts_centre": ("art", "Performing Arts"),
    "theatre": ("art", "Performing Arts"),
    "cinema": ("art", "Cinema"),
    "attraction": ("art", "Arts & Entertainment"),
    "planetarium": ("art", "Planetarium"),
    "books": ("art", "Bookstores"),
    "comics": ("art", "Comic Books"),
    "community_centre": ("art", "Community Centers"),
    "bowling_alley": ("games", "Bowling"),
    "escape_game": ("games", "Escape Games"),
    "amusement_arcade": ("games", "Arcades"),
    "miniature_golf": ("games", "Mini Golf"),
    "games": ("games", "Tabletop Games"),
    "billiards": ("games", "Pool Halls"),
    "theme_park": ("games", "Amusement Parks"),
    "hackerspace": ("games", "Hobby Shops"),
    "climbing": ("sports", "Rock Climbing"),
    "ice_rink": ("sports", "Skating Rinks"),
    "sports_centre": ("sports", "Sports Clubs"),
    "skateboard": ("sports", "Skate Parks"),
    "golf": ("sports", "Golf"),
    "axe_throwing": ("sports", "Axe Throwing"),
    "trampoline_park": ("sports", "Trampoline Parks"),
}

# OSM cuisine -> Yelp category, where a simple title-case doesn't match.
CUISINE_ALIASES = {
    "coffee_shop": "Coffee & Tea",
    "sushi": "Sushi Bars",
    "burger": "Burgers",
    "sandwich": "Sandwiches",
    "donut": "Donuts",
    "bubble_tea": "Bubble Tea",
    "steak_house": "Steakhouses",
    "bagel": "Bagels",
    "chicken": "Chicken Wings",
    "barbecue": "Barbeque",
    "breakfast": "Breakfast & Brunch",
    "brunch": "Breakfast & Brunch",
    "juice": "Juice Bars & Smoothies",
    "bakery": "Bakeries",
    "ice_cream": "Ice Cream & Frozen Yogurt",
    "tea": "Tea Rooms",
    "noodle": "Noodles",
    "dumpling": "Dumplings",
}

# Boston event names -> event type, checked in order.
EVENT_TYPES: list[tuple[str, str, str]] = [
    (
        "road-race",
        "sports",
        r"\b(5k|10k|half marathon|marathon|road race|run|walk|race|ride|bike|cycl)",
    ),
    ("block-party", "outdoors", r"block party|party in the park|night out|cookout|picnic"),
    ("parade", "outdoors", r"parade|march"),
    ("farmers-market", "food", r"market|bazaar|flea|vendor"),
    ("concert", "music", r"concert|music|jazz|band|\bdj\b|symphony|orchestra|choir|sing"),
    ("outdoor-movie", "art", r"movie|film|cinema|screening"),
    ("art-event", "art", r"\bart|gallery|mural|craft|theat|dance|poetry"),
    ("food-event", "food", r"food|taste|bbq|barbecue|truck|tasting|beer|wine|brew"),
    ("festival", "outdoors", r"fest|festival|fair|carnival|celebration|jubilee"),
    (
        "sports-event",
        "sports",
        r"yoga|fitness|tournament|football|soccer|basketball|baseball|hockey|tennis"
        r"|sports|game day",
    ),
    (
        "holiday-event",
        "outdoors",
        r"tree lighting|holiday|halloween|christmas|easter|juneteenth|pride|lunar new year|diwali",
    ),
    ("rally", "outdoors", r"rally|vigil|memorial|protest|remembrance"),
    ("ceremony", "art", r"commencement|graduation|ceremony|dedication|ribbon"),
]

# Rough neighborhood centroids for labeling places (lat, lon).
HOODS: list[tuple[str, float, float]] = [
    ("Back Bay", 42.3503, -71.0810),
    ("Beacon Hill", 42.3588, -71.0707),
    ("Downtown", 42.3555, -71.0605),
    ("North End", 42.3647, -71.0542),
    ("West End", 42.3640, -71.0640),
    ("Chinatown", 42.3496, -71.0621),
    ("South End", 42.3388, -71.0765),
    ("Fenway", 42.3429, -71.1003),
    ("Allston", 42.3539, -71.1337),
    ("Brighton", 42.3480, -71.1530),
    ("Jamaica Plain", 42.3097, -71.1151),
    ("Roxbury", 42.3152, -71.0914),
    ("Dorchester", 42.3016, -71.0676),
    ("South Boston", 42.3381, -71.0476),
    ("Seaport", 42.3519, -71.0440),
    ("East Boston", 42.3750, -71.0390),
    ("Charlestown", 42.3782, -71.0602),
    ("Mission Hill", 42.3290, -71.1060),
    ("Roslindale", 42.2832, -71.1270),
    ("West Roxbury", 42.2799, -71.1627),
    ("Mattapan", 42.2771, -71.0914),
    ("Hyde Park", 42.2565, -71.1241),
    ("Cambridge", 42.3656, -71.1040),
    ("Harvard Square", 42.3736, -71.1190),
    ("Kendall", 42.3629, -71.0901),
    ("Somerville", 42.3876, -71.0995),
    ("Brookline", 42.3318, -71.1212),
]


def label(s: str) -> str:
    """Normalize to an app label, e.g. 'Bowling Alley' -> 'bowling-alley'."""
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def log_rarity(counts: dict[str, int]) -> dict[str, float]:
    """1 - log(1+n)/log(1+max): most common -> 0, rarest -> near 1."""
    if not counts:
        return {}
    top = math.log1p(max(counts.values()))
    if top == 0:
        return {k: 0.0 for k in counts}
    return {k: 1 - math.log1p(v) / top for k, v in counts.items()}


def yelp_category_counts(lines: Iterable[str]) -> Counter:
    counts: Counter = Counter()
    for line in lines:
        line = line.strip()
        if not line:
            continue
        cats = json.loads(line).get("categories") or ""
        counts.update(c.strip() for c in cats.split(",") if c.strip())
    return counts


def yelp_name_for_cuisine(cuisine: str, yelp: dict[str, int]) -> str | None:
    if cuisine in CUISINE_ALIASES:
        return CUISINE_ALIASES[cuisine]
    title = cuisine.replace("_", " ").title()
    for cand in (title, title + "s", title.replace(" ", "-")):
        if cand in yelp:
            return cand
    return None


def neighborhood(lat: float, lon: float) -> str:
    k = math.cos(math.radians(42.35))
    return min(HOODS, key=lambda h: (h[1] - lat) ** 2 + ((h[2] - lon) * k) ** 2)[0]


def classify_event(name: str) -> tuple[str, str]:
    n = name.lower()
    for typ, cat, pattern in EVENT_TYPES:
        if re.search(pattern, n):
            return typ, cat
    return "community-event", "outdoors"


def place_key(p: dict) -> str:
    """The most specific kind of place: cuisine for restaurants, else category."""
    cuisine = (p.get("cuisine") or "").split(";")[0].strip()
    if p["category"] in ("restaurant", "fast_food", "cafe") and cuisine:
        return cuisine
    return p["category"]


def build_places(places: list[dict], yelp: dict[str, int]) -> tuple[list[dict], dict[str, float]]:
    """Score every OSM place; returns (places, label -> rarity)."""
    places = [p for p in places if p["category"] in OSM_TO_APP]
    local_counts = Counter(place_key(p) for p in places)
    yelp_r = log_rarity(dict(yelp))
    local_r = log_rarity(local_counts)

    out: list[dict] = []
    for p in places:
        key = place_key(p)
        app_cat, yelp_cat = OSM_TO_APP[p["category"]]
        cuisine = key if key != p["category"] else None
        if cuisine:
            yelp_cat = yelp_name_for_cuisine(cuisine, yelp) or yelp_cat
        rarity = YELP_WEIGHT * yelp_r.get(yelp_cat, 0.5) + LOCAL_WEIGHT * local_r[key]
        if app_cat in ("food", "coffee"):
            rarity *= DINING_DAMPING
        rarity = round(rarity, 3)
        out.append(
            {
                "id": p["osm_id"],
                "name": p["name"],
                "kind": p["category"],
                "cuisine": cuisine,
                "cat": app_cat,
                "labels": [label(p["category"])] + ([label(cuisine)] if cuisine else []),
                "hood": neighborhood(p["lat"], p["lon"]),
                "address": p.get("address"),
                "lat": round(p["lat"], 5),
                "lon": round(p["lon"], 5),
                "rarity": rarity,
                "yelpCount": yelp.get(yelp_cat, 0),
                "localCount": local_counts[key],
            }
        )

    # Label scores: a cuisine label is that cuisine's score; a category label is
    # the average place of that kind (so #restaurant stays low even though some
    # restaurants serve rare cuisines).
    table: dict[str, float] = {}
    by_label: dict[str, list[float]] = {}
    for rec in out:
        if rec["cuisine"]:
            table[label(rec["cuisine"])] = rec["rarity"]
        by_label.setdefault(label(rec["kind"]), []).append(rec["rarity"])
    for lb, vals in by_label.items():
        table[lb] = round(sum(vals) / len(vals), 3)
    return out, table


def build_events(
    rows: Iterable[dict[str, str]], today: date, back_days: int, ahead_days: int
) -> tuple[list[dict], dict[str, float]]:
    rows = [
        r for r in rows if (r.get("App Name") or "").strip() and (r.get("Status") or "") != "Void"
    ]
    rows = [r for r in rows if (r.get("App Name") or "").strip().upper() != "TEST"]
    typed = [(r, *classify_event(r["App Name"])) for r in rows]
    type_r = log_rarity(Counter(t for _, t, _ in typed))
    start, end = today - timedelta(days=back_days), today + timedelta(days=ahead_days)

    seen: set[tuple[str, str]] = set()
    out = []
    for r, typ, cat in typed:
        d = (r.get("Start Date and Time") or "")[:10]
        try:
            day = date.fromisoformat(d)
        except ValueError:
            continue
        if not (start <= day <= end):
            continue
        name = re.sub(r"\s+", " ", r["App Name"]).strip()
        if (name.lower(), d) in seen:
            continue
        seen.add((name.lower(), d))
        street = " ".join(
            x for x in (r.get("Street Number"), r.get("Street Name"), r.get("Street Suffix")) if x
        ).title()
        where = (r.get("Location Description") or "").strip() or street
        out.append(
            {
                "id": r["App Number"],
                "name": name,
                "type": typ,
                "cat": cat,
                "date": d,
                "end": (r.get("End Date and Time") or d)[:10],
                "where": where[:120],
                "hood": (r.get("City") or "Boston").strip(),
                "rarity": round(EVENT_BASE + (1 - EVENT_BASE) * type_r[typ], 3),
            }
        )
    out.sort(key=lambda e: e["date"])
    table = {t: round(EVENT_BASE + (1 - EVENT_BASE) * v, 3) for t, v in type_r.items()}
    return out, table


def main(argv: list | None = None) -> None:
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("--places", type=Path, default=Path("../data/processed/boston_places.jsonl"))
    p.add_argument(
        "--yelp", type=Path, default=Path("../data/raw/yelp/yelp_academic_dataset_business.json")
    )
    p.add_argument("--boston", type=Path, default=Path("../data/raw/boston_events.csv"))
    p.add_argument("--out", type=Path, default=Path("../web/public/data"))
    p.add_argument("--today", type=date.fromisoformat, default=date.today())
    p.add_argument("--back-days", type=int, default=90, help="Past events to include")
    p.add_argument("--ahead-days", type=int, default=60, help="Upcoming events to include")
    args = p.parse_args(argv)

    with args.yelp.open(encoding="utf-8") as f:
        yelp = yelp_category_counts(f)
    with args.places.open(encoding="utf-8") as f:
        raw_places = [json.loads(line) for line in f if line.strip()]
    with args.boston.open(encoding="utf-8", errors="replace", newline="") as f:
        events, event_table = build_events(
            csv.DictReader(f), args.today, args.back_days, args.ahead_days
        )
    places, place_table = build_places(raw_places, yelp)

    args.out.mkdir(parents=True, exist_ok=True)
    meta = {
        "generated": args.today.isoformat(),
        "sources": ["OpenStreetMap", "Yelp Open Dataset", "City of Boston"],
    }
    (args.out / "places.json").write_text(
        json.dumps({**meta, "places": places}, ensure_ascii=False, separators=(",", ":"))
    )
    (args.out / "events.json").write_text(
        json.dumps({**meta, "events": events}, ensure_ascii=False, separators=(",", ":"))
    )
    labels = {**place_table, **event_table}
    (args.out / "rarity.json").write_text(
        json.dumps({**meta, "labels": dict(sorted(labels.items()))}, indent=1)
    )

    print(f"places: {len(places)}  events: {len(events)}  labels: {len(labels)}  -> {args.out}")
    top = sorted(places, key=lambda x: -x["rarity"])[:8]
    for t in top:
        print(f"  {t['rarity']:.2f}  {t['name']} ({t['cuisine'] or t['kind']}, {t['hood']})")


if __name__ == "__main__":
    main()
