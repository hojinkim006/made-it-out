import csv
import io
import json
from datetime import date

from made_it_out_pipeline.app_data import (
    build_events,
    build_places,
    classify_event,
    label,
    log_rarity,
    main,
    neighborhood,
    yelp_category_counts,
)

YELP = {
    "Restaurants": 50000,
    "Coffee & Tea": 6000,
    "Ramen": 200,
    "Axe Throwing": 50,
    "Bowling": 190,
}


def place(i, category, cuisine=None, lat=42.35, lon=-71.08):
    return {
        "osm_id": f"node/{i}",
        "name": f"P{i}",
        "category": category,
        "cuisine": cuisine,
        "lat": lat,
        "lon": lon,
        "address": None,
    }


def test_rarity_and_label():
    r = log_rarity({"common": 1000, "rare": 1})
    assert r["common"] == 0.0 and r["rare"] > 0.8
    assert label("Bowling Alley") == "bowling-alley"


def test_yelp_counts():
    lines = [json.dumps({"categories": "Bowling, Bars"}), json.dumps({"categories": None}), ""]
    assert yelp_category_counts(lines) == {"Bowling": 1, "Bars": 1}


def test_places_rare_beats_common_and_cuisine_used():
    places = [place(i, "restaurant") for i in range(50)]
    places += [
        place(100, "restaurant", "ramen"),
        place(101, "axe_throwing"),
        place(102, "cafe", "coffee_shop"),
    ]
    places.append(place(103, "bank"))  # not a hangout, dropped
    out, table = build_places(places, YELP)
    by = {p["id"]: p for p in out}
    assert "node/103" not in by
    assert by["node/101"]["rarity"] > by["node/0"]["rarity"]
    assert by["node/100"]["rarity"] > by["node/0"]["rarity"]
    assert by["node/100"]["labels"] == ["restaurant", "ramen"]
    assert by["node/101"]["cat"] == "sports"
    assert table["axe-throwing"] > table["restaurant"]
    assert by["node/101"]["localCount"] == 1


def test_neighborhood():
    assert neighborhood(42.3647, -71.0542) == "North End"
    assert neighborhood(42.3876, -71.0995) == "Somerville"


def test_classify_event():
    assert classify_event("Dimock 5k Walk/Run") == ("road-race", "sports")
    assert classify_event("Allston Block Party")[0] == "block-party"
    assert classify_event("SoWa Open Market")[0] == "farmers-market"
    assert classify_event("Jazz on the Common")[0] == "concert"
    assert classify_event("Something Else")[0] == "community-event"


def rows(*items):
    cols = [
        "App Number",
        "App Name",
        "Status",
        "Location Description",
        "Street Number",
        "Street Name",
        "Street Suffix",
        "City",
        "Start Date and Time",
        "End Date and Time",
    ]
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=cols)
    w.writeheader()
    for i, (name, d, status) in enumerate(items):
        w.writerow(
            {
                "App Number": f"PUB{i}",
                "App Name": name,
                "Status": status,
                "Location Description": "",
                "Street Number": "1",
                "Street Name": "City Hall",
                "Street Suffix": "PZ",
                "City": "Boston",
                "Start Date and Time": d,
                "End Date and Time": d,
            }
        )
    buf.seek(0)
    return list(csv.DictReader(buf))


def test_events_window_and_filters():
    today = date(2026, 11, 21)
    rs = rows(
        ("Jazz Night", "2026-11-28", "Open"),
        ("Jazz Night", "2026-11-28", "Closed"),  # duplicate
        ("Old Parade", "2020-01-01", "Closed"),  # too old
        ("TEST", "2026-11-25", "Open"),
        ("Voided Fest", "2026-11-25", "Void"),
        ("", "2026-11-25", "Open"),
        ("Block Party", "2026-10-01", "Closed"),
    )
    events, table = build_events(rs, today, 90, 60)
    assert [e["name"] for e in events] == ["Block Party", "Jazz Night"]
    assert events[1]["where"] == "1 City Hall Pz"
    assert all(0.65 <= e["rarity"] <= 1 for e in events)
    assert "concert" in table


def test_main_writes_files(tmp_path):
    yelp = tmp_path / "y.json"
    yelp.write_text(
        "\n".join(json.dumps({"categories": c}) for c in ["Restaurants", "Restaurants, Bowling"])
    )
    places = tmp_path / "p.jsonl"
    places.write_text(
        "\n".join(json.dumps(place(i, c)) for i, c in enumerate(["restaurant", "bowling_alley"]))
    )
    boston = tmp_path / "b.csv"
    boston.write_text(
        "App Number,App Name,Status,Start Date and Time\nPUB1,Fall Fest,Open,2026-11-30\n"
    )
    out = tmp_path / "out"
    main(
        [
            "--yelp",
            str(yelp),
            "--places",
            str(places),
            "--boston",
            str(boston),
            "--out",
            str(out),
            "--today",
            "2026-11-21",
        ]
    )
    data = json.loads((out / "places.json").read_text())
    assert len(data["places"]) == 2 and data["sources"]
    assert json.loads((out / "events.json").read_text())["events"][0]["type"] == "festival"
    assert "bowling-alley" in json.loads((out / "rarity.json").read_text())["labels"]


def test_dining_is_damped_below_equally_rare_activity():
    places = [place(1, "restaurant", "ramen"), place(2, "bowling_alley")]
    places += [place(10 + i, "park") for i in range(30)]
    out, _ = build_places(places, {"Restaurants": 50000, "Ramen": 190, "Bowling": 190})
    by = {p["id"]: p for p in out}
    assert 0 < by["node/1"]["rarity"] < by["node/2"]["rarity"]
