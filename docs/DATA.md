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
web/public/data/*.json                   app data (places, events, nicheness)
```

## Run

From `pipeline/` (either `pip install -e ".[dev]"` first, or prefix commands with `PYTHONPATH=src`):

```bash
# 1. Boston places from OpenStreetMap (re-normalize a saved download with --from-raw)
python3 -m make_it_out_pipeline.osm_places

# 2. Join OSM + Yelp + Boston events into the files the web app loads
python3 -m make_it_out_pipeline.app_data
```

Step 2 writes to `web/public/data/` (committed, so the app works without the raw datasets):

| File | Contents |
|---|---|
| `places.json` | ~4.7k Boston places: name, kind, cuisine, app category, neighborhood, lat/lon, **nicheness**, and the counts behind it |
| `events.json` | City of Boston events from the last 90 days and next 60, with an inferred type and nicheness |
| `nicheness.json` | label → nicheness (e.g. `bowling-alley`, `ramen`, `block-party`), used for manual labels |

Pass `--today YYYY-MM-DD` to rebuild the event window for a specific demo date.

### How nicheness is computed
- **Places**: `0.6 × national rarity (Yelp category count) + 0.4 × Boston rarity (OSM count of the same kind)`, where rarity = `1 − log(1+n)/log(1+max)`. Restaurants and cafés use their cuisine (ramen, sushi…) when OSM has it, and food/coffee places are ×0.8 so a rare cuisine doesn't outrank an actual activity.
- **Events**: the CSV has no type column, so the type comes from keywords in the event name (5K → road race, "block party", "market"…). Nicheness = `0.65 + 0.35 × rarity of that type among Boston events` (one-off events are niche by nature).
- **Neighborhood** for places is the nearest of ~27 Boston-area centroids.

### Licensing
Credit OpenStreetMap ("© OpenStreetMap contributors", ODbL) wherever places are shown; the app does this in the footer and suggestion card. Only aggregated Yelp category counts are used (Yelp's dataset is for non-commercial/academic use). Event data is from the City of Boston open data portal.

### Where the app uses it
- **Log form**: the Location field searches places and recent events. Picking one sets the category, labels and fruit emoji, and its nicheness replaces the self-picked category's.
- **Try something new** (group page and plan form): the rarest places the group hasn't logged yet (one per kind, filterable by category), and upcoming Boston events. "Plan it" prefills a plan.
