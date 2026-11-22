import type { ActivityLog, Cat, CostRange, State } from "./types";
import { daysAgo, todayISO } from "./dates";

/**
 * Stand-in for a Gemini price estimate. A known place or activity wins,
 * otherwise the category's typical range is used. Amounts are per person.
 */
const PRICE_DB: [RegExp, CostRange][] = [
  [/yume wo katare|ramen/i, { lo: 18, hi: 25 }],
  [/tatte/i, { lo: 15, hi: 25 }],
  [/clayroom|pottery|paint and sip|painting/i, { lo: 40, hi: 55 }],
  [/wally/i, { lo: 10, hi: 20 }],
  [/potluck|friendsgiving/i, { lo: 10, hi: 20 }],
  [/museum of fine arts|\bmfa\b/i, { lo: 0, hi: 27 }],
  [/ferry|kayak|canoe/i, { lo: 3, hi: 8 }],
  [/bowling|duckpin|candlepin/i, { lo: 20, hi: 35 }],
  [/hike|blue hills|arboretum|walk|loop|picnic/i, { lo: 0, hi: 5 }],
  [/dumpling|dim sum|pho/i, { lo: 15, hi: 25 }],
  [/coffee|latte|caf[eé]|thrift/i, { lo: 6, hi: 15 }],
  [/boulder|rock gym|climb|axe/i, { lo: 25, hi: 35 }],
  [/trivia/i, { lo: 15, hi: 25 }],
  [/open mic/i, { lo: 0, hi: 10 }],
  [/board game/i, { lo: 8, hi: 15 }],
  [/ghost tour/i, { lo: 25, hi: 35 }],
  [/cookie/i, { lo: 5, hi: 10 }],
  [/escape room|trapology/i, { lo: 30, hi: 40 }],
  [/skating|frog pond/i, { lo: 0, hi: 15 }],
  [/pizza/i, { lo: 10, hi: 18 }],
  [/jazz|lilypad/i, { lo: 10, hi: 20 }],
  [/theatre|theater|movie|brattle/i, { lo: 12, hi: 16 }],
];

const CAT_PRICE: Record<Cat, CostRange> = {
  food: { lo: 15, hi: 30 },
  coffee: { lo: 6, hi: 12 },
  art: { lo: 0, hi: 30 },
  music: { lo: 10, hi: 25 },
  outdoors: { lo: 0, hi: 5 },
  water: { lo: 5, hi: 30 },
  games: { lo: 10, hi: 25 },
  sports: { lo: 15, hi: 35 },
};

export function estCost(title: string, where: string, cat?: Cat): CostRange | null {
  const text = `${title || ""} ${where || ""}`;
  const hit = PRICE_DB.find(([re]) => re.test(text));
  if (hit) return hit[1];
  return cat ? CAT_PRICE[cat] : null;
}

export function fmtRange(e: CostRange | null): string {
  if (!e) return "";
  if (e.hi === 0) return "Free";
  if (e.lo === e.hi) return `$${e.lo}`;
  return `$${e.lo}–${e.hi}`;
}

export interface Priced {
  price: number | null;
  est: CostRange | null;
}

export function hasPrice(x: Priced): boolean {
  return x.price !== null && x.price !== undefined;
}

export interface Cost {
  txt: string;
  manual: boolean;
  mid: number;
}

export function costOf(x: Priced): Cost | null {
  if (hasPrice(x)) {
    const price = x.price as number;
    return { txt: price === 0 ? "Free" : `$${price}`, manual: true, mid: price };
  }
  if (!x.est) return null;
  const range = fmtRange(x.est);
  return { txt: range === "Free" ? "Free" : `~${range}`, manual: false, mid: (x.est.lo + x.est.hi) / 2 };
}

export function costLabel(x: Priced): string {
  const c = costOf(x);
  if (!c) return "";
  return `${c.txt}${c.txt === "Free" ? "" : " per person"}${c.manual ? "" : " · est."}`;
}

/** What one member spent in the last 30 days, plus the group's average outing cost. */
export function spendOf(logs: ActivityLog[], memberId: string, today = todayISO()) {
  const cut = daysAgo(30, new Date(today + "T12:00:00"));
  const per = (l: ActivityLog) => costOf(l)?.mid ?? 0;
  const mine = logs.filter((l) => l.date >= cut && l.date <= today && l.attendeeIds.includes(memberId));
  const priced = logs.filter((l) => costOf(l));
  return {
    mine: mine.reduce((a, l) => a + per(l), 0),
    n: mine.length,
    avg: priced.length ? priced.reduce((a, l) => a + per(l), 0) / priced.length : 0,
    est: mine.some((l) => !hasPrice(l)),
  };
}

export function avgRating(ratings: Record<string, number>): number | null {
  const values = Object.values(ratings);
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const nid = () => Math.random().toString(36).slice(2, 10);

export function rateLog(s: State, logId: string, userId: string, stars: number, now = new Date()): boolean {
  const log = s.logs.find((l) => l.id === logId);
  const g = log && s.groups.find((x) => x.id === log.groupId);
  if (!log || !g || !log.attendeeIds.includes(userId) || stars < 1 || stars > 5) return false;
  log.ratings[userId] = stars;
  g.feed.push({ id: nid(), t: now.getTime(), byId: userId, k: "rate", title: log.title, n: stars });
  if (g.feed.length > 50) g.feed.splice(0, g.feed.length - 50);
  return true;
}

export function addComment(s: State, logId: string, userId: string, text: string, id: string, now = new Date()): boolean {
  const trimmed = text.trim();
  const log = s.logs.find((l) => l.id === logId);
  const g = log && s.groups.find((x) => x.id === log.groupId);
  if (!log || !g || !trimmed) return false;
  log.comments.push({ id, byId: userId, t: now.getTime(), text: trimmed.slice(0, 200) });
  g.feed.push({ id: nid(), t: now.getTime(), byId: userId, k: "comment", title: log.title, text: trimmed.slice(0, 200) });
  if (g.feed.length > 50) g.feed.splice(0, g.feed.length - 50);
  return true;
}
