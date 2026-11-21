# Architecture

```
 datasets (Yelp, Boston events, Maps, Beli)
        │
        ▼
  pipeline/ (Python) ──► data/processed/nicheness.json
                                 │
                                 ▼
  web/ (React) ── src/lib/scoring.ts ── computes points, tree stage, leaderboard
```

The backend is intentionally undecided. For the demo, the web app reads mock data from `web/src/data/mock.ts`. Good next options: Supabase/Firebase (auth + realtime voting), or a small FastAPI service next to the pipeline.

## Data model

| Entity | Fields |
|---|---|
| `User` | id, name, school?, groupIds |
| `Group` | id, name, location, memberIds, createdAt |
| `ActivityLog` | id, groupId, placeName, category, date, attendeeIds, emoji |
| `EventProposal` | id, groupId, title, place, proposedAt (time), createdAt, votes, status (`open`/`confirmed`/`cancelled`) |
| `Vote` | userId, choice (`yes`/`no`/`alt`), altTime? |

Types live in `web/src/lib/types.ts`.

## Design

Tree / natural / green theme. Colors are CSS variables in `web/src/index.css`.
