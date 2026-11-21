import type { ActivityLog, EventProposal, Group, NichenessTable } from "./types";

// Tunable constants. Keep docs/SCORING.md in sync.
export const BASE_POINTS = 10;
export const NICHE_MAX_BONUS = 40;
export const FIRST_TIME_BONUS = 15;
export const HOLIDAY_MULTIPLIER = 1.5;
export const DEFAULT_NICHENESS = 0.5;

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDay(iso: string): Date {
  // Treat date-only strings as local dates (avoid UTC off-by-one).
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T12:00:00") : new Date(iso);
}

/** Nth weekday of a month, e.g. 4th Thursday of November. weekday: 0=Sun. */
function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  const first = new Date(year, month, 1).getDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

/** Returns the holiday name if the date is a "special day", otherwise null. */
export function holidayFor(isoDate: string): string | null {
  const d = parseDay(isoDate);
  const m = d.getMonth(); // 0-based
  const day = d.getDate();
  const y = d.getFullYear();

  if (m === 11 && day >= 20 && day <= 26) return "Christmas";
  if ((m === 11 && day === 31) || (m === 0 && day === 1)) return "New Year";
  if (m === 10 && day === nthWeekday(y, 10, 4, 4)) return "Thanksgiving";
  if (m === 9 && day === 31) return "Halloween";
  if (m === 6 && day === 4) return "Independence Day";
  if (m === 1 && day === 14) return "Valentine's Day";
  return null;
}

export function nichenessOf(category: string, table: NichenessTable): number {
  const v = table[category.toLowerCase()];
  if (v === undefined || Number.isNaN(v)) return DEFAULT_NICHENESS;
  return Math.min(1, Math.max(0, v));
}

export interface PointBreakdown {
  base: number;
  niche: number;
  firstTime: number;
  holiday: string | null;
  total: number;
}

/**
 * Points for one logged activity.
 * @param priorLogs earlier logs for the same group (used for the first-time bonus)
 */
export function scoreActivity(
  log: ActivityLog,
  priorLogs: ActivityLog[],
  table: NichenessTable,
): PointBreakdown {
  const niche = Math.round(nichenessOf(log.category, table) * NICHE_MAX_BONUS);
  const isFirst = !priorLogs.some(
    (p) => p.groupId === log.groupId && p.category.toLowerCase() === log.category.toLowerCase(),
  );
  const firstTime = isFirst ? FIRST_TIME_BONUS : 0;
  const holiday = holidayFor(log.date);
  const subtotal = BASE_POINTS + niche + firstTime;
  const total = Math.round(holiday ? subtotal * HOLIDAY_MULTIPLIER : subtotal);
  return { base: BASE_POINTS, niche, firstTime, holiday, total };
}

/** Bonus for confirming an event proposal quickly. */
export function organizationBonus(event: EventProposal): number {
  if (event.status !== "confirmed" || !event.confirmedAt) return 0;
  const hours = (new Date(event.confirmedAt).getTime() - new Date(event.createdAt).getTime()) / 36e5;
  if (hours < 0) return 0;
  if (hours <= 24) return 20;
  if (hours <= 72) return 10;
  return 0;
}

/** Total score for a group: all activity points + organization bonuses. */
export function groupScore(
  groupId: string,
  logs: ActivityLog[],
  events: EventProposal[],
  table: NichenessTable,
): number {
  const own = logs
    .filter((l) => l.groupId === groupId)
    .sort((a, b) => parseDay(a.date).getTime() - parseDay(b.date).getTime());
  let total = 0;
  own.forEach((log, i) => {
    total += scoreActivity(log, own.slice(0, i), table).total;
  });
  for (const e of events) if (e.groupId === groupId) total += organizationBonus(e);
  return total;
}

export interface LeaderboardRow {
  group: Group;
  score: number;
  rank: number;
}

export function leaderboard(
  groups: Group[],
  logs: ActivityLog[],
  events: EventProposal[],
  table: NichenessTable,
  filter?: { location?: string; school?: string },
): LeaderboardRow[] {
  return groups
    .filter((g) => !filter?.location || g.location === filter.location)
    .filter((g) => !filter?.school || g.school === filter.school)
    .map((group) => ({ group, score: groupScore(group.id, logs, events, table), rank: 0 }))
    .sort((a, b) => b.score - a.score)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

export type TreeStage = "acorn" | "sprout" | "sapling" | "tree";

export const TREE_EMOJI: Record<TreeStage, string> = {
  acorn: "🌰",
  sprout: "🌱",
  sapling: "🌿",
  tree: "🌳",
};

export function groupAgeDays(group: Group, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - parseDay(group.createdAt).getTime()) / DAY_MS));
}

export function treeStage(ageDays: number): TreeStage {
  if (ageDays >= 90) return "tree";
  if (ageDays >= 30) return "sapling";
  if (ageDays >= 7) return "sprout";
  return "acorn";
}

/** Fruit appears once the group is 30+ days old: one emoji per logged activity (most recent first). */
export function treeFruit(group: Group, logs: ActivityLog[], now: Date = new Date(), max = 12): string[] {
  if (groupAgeDays(group, now) < 30) return [];
  return logs
    .filter((l) => l.groupId === group.id)
    .sort((a, b) => parseDay(b.date).getTime() - parseDay(a.date).getTime())
    .slice(0, max)
    .map((l) => l.emoji);
}
