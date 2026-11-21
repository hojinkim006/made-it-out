# Contributing

## Git workflow

1. `main` is always deployable. Don't push to it directly; CI must pass before merging.
2. Branch from `main` with a prefix:
   - `feat/<short-name>`: new feature (`feat/group-tree`)
   - `fix/<short-name>`: bug fix
   - `data/<short-name>`: pipeline / dataset work
   - `docs/<short-name>`, `chore/<short-name>`
3. Commit with [Conventional Commits](https://www.conventionalcommits.org/):
   `feat(leaderboard): add per-school filter`, `fix(scoring): cap holiday bonus`.
   Scopes: `profile`, `group`, `leaderboard`, `events`, `scoring`, `pipeline`, `ci`, `docs`.
4. Open a PR using the template. Keep PRs small (one feature or fix). Squash-merge.

## Before you push

```bash
cd web && npm run lint && npm run typecheck && npm test
cd pipeline && ruff check . && pytest
```

## Rules

- Never commit raw datasets (`data/raw/`) or `.env`. The Yelp dump is ~4 GB.
- Scoring logic lives only in `web/src/lib/scoring.ts`. If you change the rules, update `docs/SCORING.md` and the tests.

## Suggested milestones

- [ ] **M1 Skeleton**: tabs, mock data, tree visual, scoring core (this template)
- [ ] **M2 Logging**: log an activity (place, date, people), saved to backend
- [ ] **M3 Events**: propose event, vote on time/date, confirm
- [ ] **M4 Data**: pipeline outputs nicheness per category; app consumes it
- [ ] **M5 Leaderboard**: real rankings, Boston / per-school filters
- [ ] **M6 Polish**: tree growth animation, emoji fruit, demo dataset
