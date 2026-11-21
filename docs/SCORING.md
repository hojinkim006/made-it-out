# Scoring rules

Implemented in `web/src/lib/scoring.ts` (tests in `scoring.test.ts`). Numbers are starting values to tune.

## Points per log

Factors, largest share of points first:

| # | Factor | Max | How it works |
|---|---|---|---|
| 1 | Nicheness | +100 | `100 × nicheness`. If a real place/event is picked, its dataset score (Yelp + OSM, or Boston events) replaces the self-picked category's. Labels can raise it (scores from `web/public/data/nicheness.json`). See [DATA.md](DATA.md#how-nicheness-is-computed). |
| 2 | Group turnout | +60 | `60 × (attendees / members)²`. Nonlinear, so 2 of 8 people earn 4, not 15. |
| 3 | Finalization speed | +40 | Only for logs linked to a plan: `40 × (1 − hours from posted to locked in / 72)`. |
| 4 | Krillion bonus | +30 | Nobody in the whole app has logged this activity yet this calendar month. The activity is the log's first label, else its category. |
| 5 | Holiday bonus | +20 | Christmas week, New Year, Thanksgiving, Halloween, July 4, Valentine's Day, St. Patrick's Day. |

Points are computed when the log is saved and stored on it (Krillion depends on what existed at that moment).

## Group score

`sum of points of logs posted by the group's members` + streak bonus − decay, never below 0.

### Streaks
- **Daily streak**: consecutive days with a log, ending today or yesterday. From 2 days: +5/day, max +30.
- **Weekly streak**: consecutive 7-day windows with a log, ending today. From 2 weeks: +15/week, max +90.

### Decay (long inactivity)
- First month idle: −10 per full idle week.
- After that: −40, then −60 per full idle month.

## Tree
- **Size** grows with group lifetime: Acorn (<7 days, no logs) → Sprout (7) → Sapling (30) → Young tree (90) → Full canopy (180).
- **Branches + fruit**: one per log; fruit is the log's emoji.
- **Leaves** (health): 3 per streak week + 1 per streak day (+2 if active this week), max 24. Each idle week removes 4 leaves. Once the leaves are gone, further decay shrinks the tree (down to 60%).
- **Status**: Thriving (3+ week streak), Healthy (<7 days idle), Quiet (<14), Wilting (<30), Dormant.

## Leaderboards
- **Local**: groups of 3–8 in your region.
- **My school**: groups tagged with your verified university.
- **Duos**: groups of exactly 2 compete only with each other.
