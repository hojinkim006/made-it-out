import { describe, expect, it } from "vitest";
import { addComment, avgRating, costOf, estCost, fmtRange, rateLog, spendOf } from "./budget";
import type { ActivityLog, State } from "./types";

const log = (over: Partial<ActivityLog> = {}): ActivityLog => ({
  id: "l",
  groupId: "g",
  authorId: "a",
  title: "t",
  description: "",
  cat: "food",
  emoji: "🍜",
  labels: [],
  date: "2026-03-01",
  where: "",
  attendeeIds: ["a"],
  media: [],
  price: null,
  est: null,
  ratings: {},
  comments: [],
  points: { niche: 0, turnout: 0, speed: 0, krillion: 0, holiday: 0, holidayName: null, total: 0 },
  ...over,
});

describe("budget", () => {
  it("matches a known place before falling back to the category", () => {
    expect(estCost("Friendsgiving potluck", "Allston")).toEqual({ lo: 10, hi: 20 });
    expect(estCost("Night out", "Somewhere new", "coffee")).toEqual({ lo: 6, hi: 12 });
    expect(fmtRange({ lo: 0, hi: 0 })).toBe("Free");
    expect(fmtRange({ lo: 18, hi: 25 })).toBe("$18–25");
  });

  it("uses a typed price over the estimate", () => {
    expect(costOf({ price: 22, est: { lo: 1, hi: 2 } })).toEqual({ txt: "$22", manual: true, mid: 22 });
    expect(costOf({ price: 0, est: null })).toMatchObject({ txt: "Free", manual: true });
    expect(costOf({ price: null, est: { lo: 10, hi: 20 } })).toMatchObject({ txt: "~$10–20", manual: false, mid: 15 });
  });

  it("sums the last 30 days for one person and averages every priced outing", () => {
    const logs = [
      log({ id: "old", date: "2026-01-01", attendeeIds: ["a"], price: 100 }),
      log({ id: "new", date: "2026-03-20", attendeeIds: ["a", "b"], price: 20 }),
      log({ id: "est", date: "2026-03-25", attendeeIds: ["a"], est: { lo: 0, hi: 10 } }),
    ];
    const spent = spendOf(logs, "a", "2026-03-28");
    expect(spent.n).toBe(2);
    expect(spent.mine).toBe(25);
    expect(spent.est).toBe(true);
    expect(spent.avg).toBeCloseTo((100 + 20 + 5) / 3);
  });
});

describe("ratings and comments", () => {
  const state = (): State => ({
    version: 4,
    users: [],
    groups: [{ id: "g", name: "G", region: "", hood: "", createdAt: "2026-01-01", memberIds: ["a", "b"], plan: null, pastPlans: [], feed: [] }],
    logs: [log({ id: "l1", attendeeIds: ["a"], title: "Ramen" })],
  });

  it("averages stars and only lets people who went rate", () => {
    expect(avgRating({})).toBeNull();
    expect(avgRating({ a: 5, b: 3 })).toBe(4);
    const s = state();
    expect(rateLog(s, "l1", "b", 5)).toBe(false);
    expect(rateLog(s, "l1", "a", 4)).toBe(true);
    expect(s.logs[0].ratings.a).toBe(4);
    expect(s.groups[0].feed.at(-1)?.k).toBe("rate");
  });

  it("adds a comment and a feed line", () => {
    const s = state();
    expect(addComment(s, "l1", "b", "  Worth the line. ", "c1")).toBe(true);
    expect(s.logs[0].comments[0]).toMatchObject({ byId: "b", text: "Worth the line." });
    expect(s.groups[0].feed.at(-1)).toMatchObject({ k: "comment", title: "Ramen" });
  });
});
