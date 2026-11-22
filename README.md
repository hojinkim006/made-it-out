# 🌳 made it out.

Make scheduling hangouts with friends faster and more fun. Groups post events, members vote on times, and every hangout you log grows your group's tree. Doing new, rare activities (and organizing quickly) earns points on a local leaderboard.

## Features

- **Accounts**: sign up with email, username, password, display name, phone and region. Log in with email, username or phone. Optional university verification for school boards.
- **Friends**: add by unique username; search your friends when creating a group.
- **Groups** (3–8 people; pairs go on a separate Duos board): a tree that grows from an acorn over the group's lifetime, with emoji fruit for past events and green leaves for streaks (decay strips them).
- **Events, not chat**: any member posts a plan with one or more times. Everyone answers each time (yes, partly, if needed, or no). A time can be confirmed only when the host is free and enough of the group can come. The host confirms it, or it confirms itself when voting closes.
- **Logs** (like Beli): place, date, who came, description, photos/videos, and manual labels.
- **Scoring**: rarity > group turnout > finalization speed > First Bloom bonus > holiday bonus, plus streaks and decay. See [docs/SCORING.md](docs/SCORING.md).
- **Leaderboards**: local (by region), my school, duos.

- **Real Boston data**: log at real places (OpenStreetMap) with rarity from Yelp + OSM counts; "Try something new" suggests rare spots and upcoming city events. See [docs/DATA.md](docs/DATA.md).

- **Gemini plan insights**: while you type a plan ("dinner at dominos for five of us") Gemini estimates the cost per person and total for the headcount, and adds a tag like #dinner. Without a key it falls back to a built-in price list and keyword tags.

Planned: Gemini auto-labels for log titles.

## Repo layout

```
web/          React + TypeScript + Vite web app
  src/lib/    pure logic: scoring, streaks/decay, plans/votes, auth (unit tested)
  src/pages/  Auth, Profile, Group (+ Votes), Plan, Log, Leaderboard
  src/store.tsx  app state, saved to Supabase and synced live with Realtime
  src/db.ts      Supabase reads/writes
supabase/     database migrations (schema, security rules, SQL functions)
pipeline/     Python scripts: raw datasets -> rarity scores
data/raw/     downloaded datasets (git-ignored)
data/processed/ generated output (git-ignored, except samples)
docs/         architecture, scoring rules, data sources
```

## Quick start

1. Create a Supabase project. In the dashboard, open **SQL Editor**, paste `supabase/migrations/20261121000000_init.sql`, and run it once.
2. In **Authentication → URL Configuration**, set the Site URL to `http://localhost:5173` (confirmation and password-reset links go there).
3. Copy `web/.env.example` to `web/.env.local` and fill in the Supabase URL and publishable key (Project Settings → API). Never put the Supabase secret key in this file.
   For live Gemini cost estimates, deploy `supabase/functions/plan-insight` (Dashboard → Edge Functions → Deploy a new function → Via Editor, name it `plan-insight`, paste the file) and add the secret `GEMINI_API_KEY` (https://aistudio.google.com/apikey) under Edge Functions → Secrets.
4. Run:

```bash
cd web && npm install && npm run dev
```

Data pipeline (optional, needs datasets downloaded; see [docs/DATA.md](docs/DATA.md)):

```bash
cd pipeline && python3 -m pip install -e ".[dev]" && python3 -m made_it_out_pipeline.rarity
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming, commits and the PR flow. Demo: [docs/DEMO.md](docs/DEMO.md) · Docs: [Architecture](docs/ARCHITECTURE.md) · [Scoring](docs/SCORING.md) · [Data](docs/DATA.md).
