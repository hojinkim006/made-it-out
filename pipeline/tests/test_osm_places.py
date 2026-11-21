import json

from make_it_out_pipeline.osm_places import build_query, main, normalize


def test_query_covers_bbox_and_tags():
    q = build_query((1.0, 2.0, 3.0, 4.0))
    assert "(1.0,2.0,3.0,4.0)" in q
    assert "bowling_alley" in q and "escape_game" in q
    assert q.startswith("[out:json]") and q.endswith("out center tags;")


def test_normalize_nodes_and_ways():
    elements = [
        {
            "type": "node",
            "id": 1,
            "lat": 42.35,
            "lon": -71.06,
            "tags": {
                "name": "Lucky Strike",
                "leisure": "bowling_alley",
                "addr:housenumber": "145",
                "addr:street": "Ipswich St",
                "addr:city": "Boston",
            },
        },
        {
            "type": "way",
            "id": 2,
            "center": {"lat": 42.36, "lon": -71.1},
            "tags": {"name": "Ramen Spot", "amenity": "restaurant", "cuisine": "ramen"},
        },
        {"type": "node", "id": 3, "lat": 1, "lon": 1, "tags": {"amenity": "cafe"}},  # no name
        {"type": "node", "id": 4, "lat": 1, "lon": 1, "tags": {"name": "X", "amenity": "bank"}},
        {
            "type": "node",
            "id": 1,
            "lat": 42.35,
            "lon": -71.06,
            "tags": {"name": "Lucky Strike", "leisure": "bowling_alley"},
        },
    ]
    places = list(normalize(elements))
    assert [p["osm_id"] for p in places] == ["node/1", "way/2"]
    assert places[0]["address"] == "145 Ipswich St, Boston"
    assert places[0]["kind"] == "leisure"
    assert places[1]["lat"] == 42.36 and places[1]["cuisine"] == "ramen"


def test_specific_sport_beats_generic_sports_centre():
    el = {
        "type": "node",
        "id": 5,
        "lat": 42.33,
        "lon": -71.05,
        "tags": {"name": "Rock Spot", "leisure": "sports_centre", "sport": "climbing"},
    }
    (place,) = normalize([el])
    assert place["category"] == "climbing" and place["kind"] == "sport"


def test_main_from_raw(tmp_path):
    raw = tmp_path / "raw.json"
    raw.write_text(
        json.dumps(
            {
                "elements": [
                    {
                        "type": "node",
                        "id": 9,
                        "lat": 42.3,
                        "lon": -71.0,
                        "tags": {"name": "Escape Boston", "leisure": "escape_game"},
                    },
                ]
            }
        )
    )
    out = tmp_path / "places.jsonl"
    main(["--from-raw", "--raw", str(raw), "--out", str(out)])
    lines = out.read_text().splitlines()
    assert json.loads(lines[0])["category"] == "escape_game"
