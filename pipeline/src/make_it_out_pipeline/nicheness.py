"""Compute per-category nicheness scores in [0, 1].

nicheness = 1 - log(1 + count) / log(1 + max_count)

Common categories (coffee) -> ~0, rare ones -> ~1. Output feeds
web/src/lib/scoring.ts (see docs/SCORING.md).

Usage:
    python3 -m make_it_out_pipeline.nicheness \
        --yelp ../data/raw/yelp/yelp_academic_dataset_business.json \
        --boston ../data/raw/boston_events.csv \
        --out ../data/processed/nicheness.json
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from collections import Counter
from pathlib import Path
from typing import Iterable, Iterator


def iter_yelp_categories(lines: Iterable[str], city: str | None = None) -> Iterator[str]:
    """Yield lower-cased categories from Yelp business JSON lines (streamed; file is large)."""
    for line in lines:
        line = line.strip()
        if not line:
            continue
        biz = json.loads(line)
        if city and (biz.get("city") or "").lower() != city.lower():
            continue
        for cat in (biz.get("categories") or "").split(","):
            cat = cat.strip().lower()
            if cat:
                yield cat


def iter_boston_event_types(rows: Iterable[dict[str, str]], column: str) -> Iterator[str]:
    """Yield lower-cased event types from Boston special-event CSV rows."""
    for row in rows:
        value = (row.get(column) or "").strip().lower()
        if value:
            yield value


def compute_nicheness(counts: dict[str, int]) -> dict[str, float]:
    if not counts:
        return {}
    max_log = math.log1p(max(counts.values()))
    if max_log == 0:
        return {k: 0.0 for k in counts}
    return {k: round(1 - math.log1p(v) / max_log, 4) for k, v in sorted(counts.items())}


def main(argv: list | None = None) -> None:
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("--yelp", type=Path, help="Yelp business JSON-lines file")
    p.add_argument("--city", default=None, help="Only count Yelp businesses in this city")
    p.add_argument("--boston", type=Path, help="Boston special event license CSV")
    p.add_argument(
        "--boston-column", default="event_type", help="CSV column holding the event type"
    )
    p.add_argument("--out", type=Path, default=Path("../data/processed/nicheness.json"))
    args = p.parse_args(argv)

    counts: Counter = Counter()
    if args.yelp:
        with args.yelp.open(encoding="utf-8") as f:
            counts.update(iter_yelp_categories(f, args.city))
    if args.boston:
        with args.boston.open(encoding="utf-8", newline="") as f:
            counts.update(iter_boston_event_types(csv.DictReader(f), args.boston_column))
    if not counts:
        p.error("no input data: pass --yelp and/or --boston (see docs/DATA.md)")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(compute_nicheness(counts), indent=2))
    print(f"wrote {len(counts)} categories to {args.out}")


if __name__ == "__main__":
    main()
