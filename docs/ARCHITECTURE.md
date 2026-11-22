# Architecture

```
 datasets (Yelp, Boston events, Maps, Beli)
        │
        ▼
  pipeline/ (Python) ──► data/processed/rarity.json
                                 │
                                 ▼
  web/ (React) ── src/lib/scoring.ts ── computes points, tree stage, leaderboard
```

**Backend: Supabase** (Postgres, Auth, Realtime, Storage). Schema, row level security and SQL functions are in `supabase/migrations/`.

- `web/src/supabase.ts` creates the client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `web/src/db.ts` loads rows into the `State` shape from `lib/types.ts` and saves changes.
- `web/src/store.tsx` keeps the `update(fn)` API. Each change shows immediately, then is saved by re-running `fn` on the latest database copy. Groups and logs have a `version` column; if someone else saved first, the row is re-read and `fn` runs again on top. Realtime pushes other members' changes to every open app.
- Plans, past plans and the feed are JSON on the group row, so `lib/plans.ts` is unchanged.
- Leaderboards and the First Bloom bonus use the `board()` SQL function: every group's name, members and log points, without plans, photos or comments.
- Log in by username or phone goes through `login_email()`, which checks the password in the database before returning the account email (5 failures per 15 minutes).
- Photos and videos go to the public `media` bucket under `{group}/{log}/{id}`; only members can upload to their group's folder.
- Gemini runs in the Edge Function `supabase/functions/plan-insight` (key stored as a Supabase secret); only signed-in users can call it. Auto-confirm runs in any member's open app.

## Data model

Types live in `web/src/lib/types.ts`.

| Entity | Fields |
|---|---|
| `User` | id, username (unique), email, phone, displayName, region, school?, friendIds (email/phone only loaded for yourself) |
| `Group` | id, name, region, hood, school?, createdAt, memberIds (2–8), plan, pastPlans |
| `Plan` | id, title, where, note, price, est, byId, hostId, createdAt, extMs, auto, pickId, options[], confirmedOptionId, start, goingIds, requests, confirmedAt? |
| `TimeOption` | id, byId, date, time, resp (yes / partly / if needed / no, with an optional window) |
| `Group.feed` | live updates (posts, answers, confirms, handoffs, ratings, comments) |
| `ActivityLog` | id, groupId, authorId, title, description, cat, emoji, labels, date, where, attendeeIds, media, eventId?, price, est, ratings, comments, points |

## Design

From `made-it-out.html`: monochrome, card-based UI with a dotted background; styles in `web/src/index.css`.
