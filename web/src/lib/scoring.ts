import type { ActivityLog, Cat, Competitor, Group, Plan, PointBreakdown } from "./types";
import { daysBetween, monthKey, parseD, todayISO } from "./dates";

/*
 * Scoring rules. Keep docs/SCORING.md in sync.
 * Factors, largest share of points first:
 *   rarity > group turnout > finalization speed > First Bloom bonus > holiday bonus
 */
export const RARITY_MAX = 100;
export const TURNOUT_MAX = 60;
export const SPEED_MAX = 40;
export const FIRST_BLOOM_BONUS = 30;
export const HOLIDAY_BONUS = 20;
/** Plans confirmed after this many hours earn no speed points. */
export const SPEED_WINDOW_H = 72;

export const MIN_GROUP = 2;
export const MAX_GROUP = 8;

export const CATS: Record<Cat, { label: string; emoji: string; rarity: number }> = {
  water: { label: "Water", emoji: "🛶", rarity: 0.85 },
  art: { label: "Art", emoji: "🎨", rarity: 0.6 },
  outdoors: { label: "Outdoors", emoji: "🥾", rarity: 0.6 },
  music: { label: "Music", emoji: "🎷", rarity: 0.5 },
  sports: { label: "Sports", emoji: "⛸️", rarity: 0.4 },
  games: { label: "Games", emoji: "🎲", rarity: 0.3 },
  food: { label: "Food", emoji: "🍜", rarity: 0.12 },
  coffee: { label: "Coffee", emoji: "☕", rarity: 0.05 },
};

const OTHER_CAT = { label: "Other", emoji: "📍", rarity: 0.3 };
const warned = new Set<string>();

/**
 * Safe lookup for a category read from stored data. Logs saved by older app
 * versions can carry a category this list no longer has, or none at all.
 */
export function catInfo(cat: string | null | undefined) {
  const hit = CATS[cat as Cat];
  if (hit) return hit;
  const key = String(cat);
  if (!warned.has(key)) {
    warned.add(key);
    console.warn(`Unknown log category ${JSON.stringify(cat)}; showing it as "Other".`);
  }
  return OTHER_CAT;
}

/**
 * Label rarity in [0, 1]. Will be replaced by pipeline output
 * (data/processed/rarity.json). Unknown labels don't change the score.
 */
export const LABEL_RARITY: Record<string, number> = {
  restaurant: 0.08,
  cafe: 0.05,
  bar: 0.15,
  museum: 0.5,
  hike: 0.55,
  concert: 0.45,
  bowling: 0.45,
  "escape-room": 0.7,
  climbing: 0.65,
  pottery: 0.8,
  kayak: 0.85,
  "axe-throwing": 0.9,
  festival: 0.75,
};

export const normLabel = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export interface RaritySources {
  /** Label scores from the data pipeline (web/public/data/rarity.json). */
  labelRarity?: Record<string, number>;
  /** Rarity of the specific place or event that was picked. */
  placeRarity?: number;
}

/**
 * Rarity in [0, 1]. With a picked place, the dataset score for that place
 * replaces the self-chosen category (so picking "Water" can't inflate a café).
 */
export function rarityOf(cat: Cat, labels: string[], src: RaritySources = {}): number {
  const fromLabels = labels.map((l) => {
    const k = normLabel(l);
    return src.labelRarity?.[k] ?? LABEL_RARITY[k] ?? 0;
  });
  const base = src.placeRarity ?? CATS[cat].rarity;
  return Math.max(base, ...fromLabels);
}

/** Nonlinear in the share of the group that showed up, so 2 of 8 can't farm points. */
export function turnoutPoints(attendees: number, members: number): number {
  if (members <= 0 || attendees <= 0) return 0;
  const share = Math.min(1, attendees / members);
  return Math.round(TURNOUT_MAX * share * share);
}

/** Faster from "posted" to "locked in" = more points. */
export function speedPoints(plan: Pick<Plan, "createdAt" | "confirmedAt"> | undefined): number {
  if (!plan?.confirmedAt) return 0;
  const hours = (new Date(plan.confirmedAt).getTime() - new Date(plan.createdAt).getTime()) / 36e5;
  if (hours < 0) return 0;
  return Math.round(SPEED_MAX * Math.max(0, 1 - hours / SPEED_WINDOW_H));
}

/** Nth weekday of a month, e.g. 4th Thursday of November. weekday: 0=Sun. */
function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  const first = new Date(year, month, 1).getDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

export function holidayFor(date: string): string | null {
  const d = parseD(date);
  const m = d.getMonth();
  const day = d.getDate();
  const y = d.getFullYear();
  if (m === 11 && day >= 20 && day <= 26) return "Christmas";
  if ((m === 11 && day === 31) || (m === 0 && day === 1)) return "New Year";
  if (m === 10 && day === nthWeekday(y, 10, 4, 4)) return "Thanksgiving";
  if (m === 9 && day === 31) return "Halloween";
  if (m === 6 && day === 4) return "Independence Day";
  if (m === 1 && day === 14) return "Valentine's Day";
  if (m === 2 && day === 17) return "St. Patrick's Day";
  return null;
}

/** The "activity" a log represents: its first label, else its category. */
export const activityKey = (log: Pick<ActivityLog, "labels" | "cat">) =>
  log.labels.length ? normLabel(log.labels[0]) : log.cat;

/**
 * First Bloom bonus: nobody in the whole app has logged this activity yet this month.
 * @param earlier every log in the database saved before this one
 */
export function isFirstBloom(
  log: Pick<ActivityLog, "labels" | "cat" | "date">,
  earlier: Pick<ActivityLog, "labels" | "cat" | "date">[],
): boolean {
  const key = activityKey(log);
  const month = monthKey(log.date);
  return !earlier.some((l) => monthKey(l.date) === month && activityKey(l) === key);
}

export function scoreLog(
  log: Pick<ActivityLog, "cat" | "labels" | "date" | "attendeeIds">,
  memberCount: number,
  earlier: Pick<ActivityLog, "labels" | "cat" | "date">[],
  plan?: Pick<Plan, "createdAt" | "confirmedAt">,
  src: RaritySources = {},
): PointBreakdown {
  const rarity = Math.round(rarityOf(log.cat, log.labels, src) * RARITY_MAX);
  const turnout = turnoutPoints(log.attendeeIds.length, memberCount);
  const speed = speedPoints(plan);
  const firstBloom = isFirstBloom(log, earlier) ? FIRST_BLOOM_BONUS : 0;
  const holidayName = holidayFor(log.date);
  const holiday = holidayName ? HOLIDAY_BONUS : 0;
  return { rarity, turnout, speed, firstBloom, holiday, holidayName, total: rarity + turnout + speed + firstBloom + holiday };
}

/* ---------------- streaks, decay, tree health ---------------- */

export interface Health {
  dailyStreak: number; // consecutive days with a log, ending today or yesterday
  weeklyStreak: number; // consecutive 7-day windows with a log, ending today
  daysSinceLast: number | null;
  streakBonus: number;
  decay: number;
  /** Green leaves on the tree. Streaks add them, decay removes them first. */
  leaves: number;
  /** Tree scale multiplier once decay has taken every leaf (1 = full size). */
  shrink: number;
  status: "Thriving" | "Healthy" | "Quiet" | "Wilting" | "Dormant" | "New";
}

export const DAILY_STREAK_BONUS = 5; // per day, from 2 days
export const DAILY_STREAK_CAP = 30;
export const WEEKLY_STREAK_BONUS = 15; // per week, from 2 weeks
export const WEEKLY_STREAK_CAP = 90;
export const WEEKLY_DECAY = 10; // per idle week, during the first month
export const MONTHLY_DECAY = 60; // per idle month after that
export const MAX_LEAVES = 24;

export function decayPoints(daysIdle: number): number {
  if (daysIdle < 7) return 0;
  if (daysIdle < 30) return WEEKLY_DECAY * Math.floor(daysIdle / 7);
  return WEEKLY_DECAY * 4 + MONTHLY_DECAY * Math.floor(daysIdle / 30);
}

export function groupHealth(logDates: string[], today = todayISO()): Health {
  const days = new Set(logDates.filter((d) => d <= today));
  if (!days.size)
    return { dailyStreak: 0, weeklyStreak: 0, daysSinceLast: null, streakBonus: 0, decay: 0, leaves: 0, shrink: 1, status: "New" };

  const sorted = [...days].sort();
  const last = sorted[sorted.length - 1];
  const daysSinceLast = daysBetween(last, today);

  let dailyStreak = 0;
  if (daysSinceLast <= 1) {
    const cursor = parseD(last);
    while (days.has(isoOf(cursor))) {
      dailyStreak++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  let weeklyStreak = 0;
  for (let w = 0; ; w++) {
    const hit = sorted.some((d) => {
      const ago = daysBetween(d, today);
      return ago >= w * 7 && ago < (w + 1) * 7;
    });
    if (!hit) break;
    weeklyStreak++;
  }

  const streakBonus =
    (dailyStreak >= 2 ? Math.min(DAILY_STREAK_CAP, DAILY_STREAK_BONUS * dailyStreak) : 0) +
    (weeklyStreak >= 2 ? Math.min(WEEKLY_STREAK_CAP, WEEKLY_STREAK_BONUS * weeklyStreak) : 0);
  const decay = decayPoints(daysSinceLast);

  // Leaves: 3 per streak week + 1 per streak day; each idle week strips 4.
  const grown = Math.min(MAX_LEAVES, weeklyStreak * 3 + dailyStreak + (daysSinceLast < 7 ? 2 : 0));
  const idleWeeks = Math.floor(daysSinceLast / 7);
  const net = grown - idleWeeks * 4;
  const leaves = Math.max(0, net);
  const shrink = net >= 0 ? 1 : Math.max(0.6, 1 + net * 0.04);

  const status: Health["status"] =
    weeklyStreak >= 3 ? "Thriving" : daysSinceLast < 7 ? "Healthy" : daysSinceLast < 14 ? "Quiet" : daysSinceLast < 30 ? "Wilting" : "Dormant";

  return { dailyStreak, weeklyStreak, daysSinceLast, streakBonus, decay, leaves, shrink, status };
}

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Group score: sum of members' log points in this group, plus streaks, minus decay (never below 0). */
export function groupScore(group: Group, logs: ActivityLog[], today = todayISO()) {
  const own = logs.filter((l) => l.groupId === group.id && group.memberIds.includes(l.authorId));
  const base = own.reduce((a, l) => a + l.points.total, 0);
  const health = groupHealth(own.map((l) => l.date), today);
  return { base, health, total: Math.max(0, base + health.streakBonus - health.decay), outings: own.length };
}

/* ---------------- tree growth by lifetime ---------------- */

export type Stage = "Acorn" | "Sprout" | "Sapling" | "Young tree" | "Full canopy";

export function stageFor(ageDays: number): Stage {
  if (ageDays < 7) return "Acorn";
  if (ageDays < 30) return "Sprout";
  if (ageDays < 90) return "Sapling";
  if (ageDays < 180) return "Young tree";
  return "Full canopy";
}

export const STAGE_SCALE: Record<Stage, number> = {
  Acorn: 0.45,
  Sprout: 0.62,
  Sapling: 0.78,
  "Young tree": 0.9,
  "Full canopy": 1,
};

/** Days until the next stage, or null at full size. */
export function nextStageIn(ageDays: number): { stage: Stage; days: number } | null {
  const marks: [number, Stage][] = [
    [7, "Sprout"],
    [30, "Sapling"],
    [90, "Young tree"],
    [180, "Full canopy"],
  ];
  const next = marks.find(([d]) => d > ageDays);
  return next ? { stage: next[1], days: next[0] - ageDays } : null;
}

/* ---------------- leaderboards ---------------- */

export type BoardScope = "local" | "school" | "duos";

export interface BoardRow extends Competitor {
  id?: string;
  mine: boolean;
  rank: number;
}

export const isDuo = (g: Group) => g.memberIds.length === 2;

export function boardRows(
  scope: BoardScope,
  groups: Group[],
  logs: ActivityLog[],
  competitors: Competitor[],
  filter: { region?: string; school?: string; mineIds?: string[] },
  today = todayISO(),
): BoardRow[] {
  const eligible = groups.filter((g) => {
    if (scope === "duos") return isDuo(g);
    if (isDuo(g)) return false;
    if (scope === "school") return !!filter.school && g.school === filter.school;
    return !filter.region || g.region === filter.region;
  });
  const ours = eligible.map((g) => {
    const s = groupScore(g, logs, today);
    return {
      id: g.id,
      name: g.name,
      size: g.memberIds.length,
      hood: scope === "school" ? (g.school ?? "") : g.hood,
      outings: s.outings,
      pts: s.total,
      mine: !!filter.mineIds?.includes(g.id),
      rank: 0,
    };
  });
  return [...competitors.map((c) => ({ ...c, mine: false, rank: 0 })), ...ours]
    .sort((a, b) => b.pts - a.pts)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
