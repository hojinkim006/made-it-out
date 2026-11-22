import type { CostRange } from "./types";

/** Tags Gemini may pick from, shown as #tag on a plan. */
export const PLAN_TAGS = [
  "dinner",
  "lunch",
  "brunch",
  "coffee",
  "drinks",
  "dessert",
  "outing",
  "friends-date",
  "movie",
  "game-night",
  "outdoors",
  "sports",
  "concert",
  "art",
  "party",
  "study",
  "shopping",
] as const;
export type PlanTag = (typeof PLAN_TAGS)[number];

export interface PlanInsight {
  /** Headcount read from the text ("for five of us"), else the group size. */
  people: number;
  /** Per person, USD. */
  lo: number;
  hi: number;
  basis: string;
  tag: PlanTag | null;
}

/** Offline fallback when Gemini is unavailable. First match wins, so specific beats general. */
const TAG_RULES: [RegExp, PlanTag][] = [
  [/brunch/i, "brunch"],
  [/\blunch\b/i, "lunch"],
  [/dinner|pizza|domino|ramen|sushi|bbq|tacos?|burgers?|restaurant|dumpling|pho|dim sum|potluck|friendsgiving/i, "dinner"],
  [/coffee|latte|caf[eé]|tea\b|boba/i, "coffee"],
  [/drinks?|bar\b|beers?|brewery|cocktails?|wine/i, "drinks"],
  [/ice cream|dessert|cookie|bakery|donut/i, "dessert"],
  [/movie|film|cinema|theat(er|re)/i, "movie"],
  [/board game|game night|trivia|escape room|arcade|bowling/i, "game-night"],
  [/concert|jazz|gig|open mic|show\b/i, "concert"],
  [/museum|gallery|pottery|paint|art\b/i, "art"],
  [/hike|walk|picnic|park|beach|kayak|canoe|ferry|arboretum/i, "outdoors"],
  [/climb|boulder|skating|game\b|soccer|basketball|gym|run\b/i, "sports"],
  [/party|birthday|celebrat/i, "party"],
  [/study|homework|library|exam/i, "study"],
  [/shop|thrift|mall|market/i, "shopping"],
  [/date|catch up|hang ?out/i, "friends-date"],
];

export function guessTag(title: string, where = ""): PlanTag | null {
  const text = `${title} ${where}`.trim();
  if (!text) return null;
  return TAG_RULES.find(([re]) => re.test(text))?.[1] ?? "outing";
}

const WORD_NUMS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };

/** Offline fallback for "for five of us" / "6 people". */
export function guessPeople(text: string): number | null {
  const m = text.match(/\b(\d{1,2}|two|three|four|five|six|seven|eight|nine|ten|twelve)\s*(?:of us|people|friends|ppl|guys)|\bfor\s+(\d{1,2}|two|three|four|five|six|seven|eight|nine|ten|twelve)\b/i);
  const w = (m?.[1] ?? m?.[2])?.toLowerCase();
  if (!w) return null;
  const n = WORD_NUMS[w] ?? Number(w);
  return n > 0 ? n : null;
}

export function totalRange(est: CostRange, people: number): CostRange {
  return { lo: est.lo * people, hi: est.hi * people };
}
