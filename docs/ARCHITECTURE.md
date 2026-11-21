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

**No backend yet.** `web/src/store.tsx` keeps all data in `localStorage` and syncs every open window on the same computer through the `storage` event, so the demo feels live. Each window has its own signed-in user (`sessionStorage`). Passwords are SHA-256 hashed client-side, which is **demo-only, not secure**. Next step: Supabase or Firebase for auth + realtime, keeping `lib/` unchanged.

## Data model

Types live in `web/src/lib/types.ts`.

| Entity | Fields |
|---|---|
| `User` | id, username (unique), email, phone, passHash, displayName, region, school?, friendIds |
| `Group` | id, name, region, hood, school?, createdAt, memberIds (2–8), plan, pastPlans |
| `Plan` | id, title, where, note, price, est, byId, hostId, createdAt, extMs, auto, pickId, options[], confirmedOptionId, start, goingIds, requests, confirmedAt? |
| `TimeOption` | id, byId, date, time, resp (yes / partly / if needed / no, with an optional window) |
| `Group.feed` | live updates (posts, answers, confirms, handoffs, ratings, comments) |
| `ActivityLog` | id, groupId, authorId, title, description, cat, emoji, labels, date, where, attendeeIds, media, eventId?, price, est, ratings, comments, points |

## Design

From `make-it-out.html`: monochrome, card-based UI with a dotted background; styles in `web/src/index.css`.
