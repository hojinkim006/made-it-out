# 🌳 Make It Out

Make scheduling hangouts with friends faster and more fun. Groups post events, members vote on times, and every hangout you log grows your group's tree. Doing new, niche activities (and organizing quickly) earns points on a local leaderboard.

## Core ideas

| Concept | What it means here |
|---|---|
| **Log it** (inspired by Beli) | Log an activity with place, date and who came. |
| **Nicheness** (inspired by Krillion) | Rarer activities score more, based on Yelp + Boston event data. |
| **Group tree** | Each group starts as an 🌰 acorn and grows with group lifetime; past events grow on it as emoji fruit. |
| **No chat, only events** | Members propose an event (e.g. "dinner @ ___ @ 5pm") and vote on time/date changes. One place for plans. |
| **Leaderboard** | Sum of group log points; filter locally (Boston, per school). |

## App layout

- **Profile** (home screen): your groups, quick personal stats
- **Group**: tree, name, location, members, events, log history
- **Leaderboard**: group rankings by area

## Repo layout

```
web/          React + TypeScript + Vite web app
  src/lib/    pure domain logic (scoring, tree growth), unit tested
  src/pages/  Profile, Group, Leaderboard tabs
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

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming, commits and the PR flow. Docs: [Architecture](docs/ARCHITECTURE.md) · [Scoring](docs/SCORING.md) · [Data](docs/DATA.md).
