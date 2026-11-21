# Data sources

Put downloads in `data/raw/` (git-ignored). Generated files go to `data/processed/` (also git-ignored).

| Source | Use | How to get | Notes |
|---|---|---|---|
| [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API | **Real Boston places** to log (restaurants, bowling, escape rooms, climbing, museums…) | `osm_places` script below downloads it | Free, no key. Covers Boston, Cambridge, Somerville, Brookline. ~4.7k places; ~60% have an address. Data © OpenStreetMap contributors, ODbL: credit OSM in the app. |
| [Yelp Open Dataset](https://business.yelp.com/data/resources/open-dataset/) | Category popularity → nicheness | Download, extract only `yelp_academic_dataset_business.json` into `data/raw/yelp/` | **Has no Boston businesses** (covers Philadelphia, Tampa, Nashville, etc.), so use it nationally for "how rare is this activity", not for Boston places. Non-commercial license. Full archive unpacks to ~9 GB; only the 119 MB business file is needed. |
| [Boston special event licenses](https://data.boston.gov/dataset/special-event-license-applications) | One-off local events (very niche) | Download CSV to `data/raw/boston_events.csv` | ~8.6k rows. Check the event-type column name and pass `--boston-column`. |
| Google Maps (Places API) | Place lookup / autocomplete when logging | API key in `.env` | Costs money past free tier; don't call from CI |
| Beli | Reference for logging UX | No public dataset | Inspiration only |

## Layout

```
data/raw/osm/boston_overpass.json         raw OSM download
data/raw/yelp/yelp_academic_dataset_business.json
data/raw/boston_events.csv
data/processed/boston_places.jsonl        one Boston place per line
data/processed/nicheness.json             category -> score in [0, 1]
```

## Run

From `pipeline/` (either `pip install -e ".[dev]"` first, or prefix commands with `PYTHONPATH=src`):

```bash
# Boston places from OpenStreetMap (re-normalize a saved download with --from-raw)
python3 -m make_it_out_pipeline.osm_places

# Nicheness from Yelp (all cities) + Boston events
python3 -m make_it_out_pipeline.nicheness --yelp ../data/raw/yelp/yelp_academic_dataset_business.json --boston ../data/raw/boston_events.csv --out ../data/processed/nicheness.json
```

Each line of `boston_places.jsonl`:

```json
{"osm_id": "node/1712242954", "name": "Lucky Strike Social Boston", "category": "bowling_alley", "kind": "leisure", "cuisine": null, "lat": 42.347, "lon": -71.094, "address": "145 Ipswich Street, Boston", "website": null}
```

OSM categories (`bowling_alley`, `escape_game`) and Yelp categories ("bowling", "escape games") use different names; map them before scoring Boston places with Yelp-based nicheness.
