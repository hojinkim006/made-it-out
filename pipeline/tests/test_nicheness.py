import json

from make_it_out_pipeline.nicheness import (
    compute_nicheness,
    iter_boston_event_types,
    iter_yelp_categories,
    main,
)


def test_common_categories_score_low():
    scores = compute_nicheness({"coffee": 1000, "axe throwing": 3})
    assert scores["coffee"] == 0.0
    assert 0.5 < scores["axe throwing"] < 1.0


def test_empty_counts():
    assert compute_nicheness({}) == {}


def test_yelp_parsing_and_city_filter():
    lines = [
        json.dumps({"city": "Boston", "categories": "Coffee & Tea, Cafes"}),
        json.dumps({"city": "Austin", "categories": "Bars"}),
        json.dumps({"city": "Boston", "categories": None}),
        "",
    ]
    assert list(iter_yelp_categories(lines, city="boston")) == ["coffee & tea", "cafes"]


def test_boston_rows():
    rows = [{"event_type": "Street Festival"}, {"event_type": ""}]
    assert list(iter_boston_event_types(rows, "event_type")) == ["street festival"]


def test_main_writes_output(tmp_path):
    src = tmp_path / "biz.json"
    src.write_text(json.dumps({"city": "Boston", "categories": "Pizza, Bowling"}) + "\n")
    out = tmp_path / "out.json"
    main(["--yelp", str(src), "--out", str(out)])
    assert set(json.loads(out.read_text())) == {"pizza", "bowling"}
