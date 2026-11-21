# Data sources

Put downloads in `data/raw/` (git-ignored). The demo uses the last few months of data.

| Source | Use | How to get | Notes |
|---|---|---|---|
| [Yelp Open Dataset](https://business.yelp.com/data/resources/open-dataset/) | Category popularity → nicheness | Download, extract `yelp_academic_dataset_business.json` into `data/raw/yelp/` | ~4 GB total, ~7M reviews. Only the business file is needed for nicheness; it streams line by line. |
| [Boston special event licenses](https://data.boston.gov/dataset/special-event-license-applications) | One-off local events (very niche) | Download CSV to `data/raw/boston_events.csv` | ~8.6k rows, small |
| Google Maps (Places API) | Place lookup / autocomplete when logging | API key in `.env` | Costs money past free tier; don't call from CI |
| Beli | Reference for logging UX | No public dataset | Inspiration only |

Run:

```bash
cd pipeline
python3 -m make_it_out_pipeline.nicheness --yelp ../data/raw/yelp/yelp_academic_dataset_business.json --out ../data/processed/nicheness.json
```
