# 🌳 make it out.

Make scheduling hangouts with friends faster and more fun. Groups post events, members vote on times, and every hangout you log grows your group's tree. Doing new, niche activities (and organizing quickly) earns points on a local leaderboard.

## Features

- **Accounts**: sign up with email, username, password, display name, phone and region. Log in with email, username or phone. Optional university verification for school boards.
- **Friends**: add by unique username; search your friends when creating a group.
- **Groups** (3–8 people; pairs go on a separate Duos board): a tree that grows from an acorn over the group's lifetime, with emoji fruit for past events and green leaves for streaks (decay strips them).
- **Events, not chat**: any member posts a plan with one or more times. Everyone answers each time (yes, partly, if needed, or no). A time can be confirmed only when the host is free and enough of the group can come. The host confirms it, or it confirms itself when voting closes.
- **Logs** (like Beli): place, date, who came, description, photos/videos, and manual labels.
- **Scoring**: nicheness > group turnout > finalization speed > Krillion bonus > holiday bonus, plus streaks and decay. See [docs/SCORING.md](docs/SCORING.md).
- **Leaderboards**: local (by region), my school, duos.

- **Real Boston data**: log at real places (OpenStreetMap) with nicheness from Yelp + OSM counts; "Try something new" suggests rare spots and upcoming city events. See [docs/DATA.md](docs/DATA.md).

Planned: Gemini auto-labels for log titles.

## Repo layout

```
web/          React + TypeScript + Vite web app
  src/lib/    pure logic: scoring, streaks/decay, plans/votes, auth (unit tested)
  src/pages/  Auth, Profile, Group (+ Votes), Plan, Log, Leaderboard
  src/store.tsx  demo data store, synced live across browser windows
pipeline/     Python scripts: raw datasets -> nicheness scores
data/raw/     downloaded datasets (git-ignored)
data/processed/ generated output (git-ignored, except samples)
docs/         architecture, scoring rules, data sources
```

## Quick start

```bash
cd web && npm install && npm run dev
```

Data pipeline (optional, needs datasets downloaded; see [docs/DATA.md](docs/DATA.md)):

```bash
cd pipeline && python3 -m pip install -e ".[dev]" && python3 -m make_it_out_pipeline.nicheness
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming, commits and the PR flow. Demo: [docs/DEMO.md](docs/DEMO.md) · Docs: [Architecture](docs/ARCHITECTURE.md) · [Scoring](docs/SCORING.md) · [Data](docs/DATA.md).
