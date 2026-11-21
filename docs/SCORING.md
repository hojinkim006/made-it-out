# Scoring rules

Implemented in `web/src/lib/scoring.ts` (tested in `scoring.test.ts`). Numbers are starting values to tune.

## Points per logged activity

```
points = BASE (10)
       + nicheness bonus   round(nicheness × 40), nicheness ∈ [0, 1]
       + first-time bonus  +15 if this group has never logged this category
       + holiday bonus     ×1.5 on special days (Christmas season, Thanksgiving, July 4, Halloween, NYE, Valentine's)
```

## Confirming events quickly

When an event proposal is confirmed, the group gets an organization bonus:
- confirmed within 24 h of proposal: **+20**
- within 72 h: **+10**
- later: **+0**

## Nicheness

Produced by the pipeline per category: `1 − normalized log(popularity)`. Very common categories (coffee, pizza) get near 0, rare ones (axe throwing, a one-off street festival) get near 1. Unknown categories default to 0.5.

## Group score & leaderboard

Group score = sum of all its activity points + organization bonuses. Leaderboards filter groups by city or school.

## Tree growth

Based on group age (days since `createdAt`):

| Stage | Age |
|---|---|
| 🌰 acorn | 0–6 days |
| 🌱 sprout | 7–29 |
| 🌿 sapling | 30–89 |
| 🌳 tree | 90+ |
| fruit | from 30 days, each logged activity's emoji hangs on the tree |
