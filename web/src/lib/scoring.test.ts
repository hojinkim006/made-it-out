import { describe, expect, it } from "vitest";
import {
  boardRows,
  decayPoints,
  groupHealth,
  groupScore,
  holidayFor,
  isFirstBloom,
  rarityOf,
  scoreLog,
  speedPoints,
  stageFor,
  turnoutPoints,
} from "./scoring";
import type { ActivityLog, Group } from "./types";

const group = (over: Partial<Group> = {}): Group => ({
  id: "g1",
  name: "G",
  region: "Boston, MA",
  hood: "Boston",
  createdAt: "2026-01-01",
  memberIds: ["a", "b", "c", "d"],
  plan: null,
  pastPlans: [],
  feed: [],
  ...over,
});

const log = (over: Partial<ActivityLog> = {}): ActivityLog => ({
  id: Math.random().toString(36),
  groupId: "g1",
  authorId: "a",
  title: "t",
  description: "",
  cat: "food",
  emoji: "🍜",
  labels: [],
  date: "2026-03-10",
  where: "",
  attendeeIds: ["a"],
  media: [],
  price: null,
  est: null,
  ratings: {},
  comments: [],
  points: { rarity: 0, turnout: 0, speed: 0, firstBloom: 0, holiday: 0, holidayName: null, total: 10 },
  ...over,
});

describe("factors", () => {
  it("rarity uses the rarest of category and labels", () => {
    expect(rarityOf("coffee", [])).toBe(0.05);
    expect(rarityOf("food", ["#Axe Throwing"])).toBe(0.9);
    expect(rarityOf("art", ["unknown"])).toBe(0.6);
  });
  it("turnout is nonlinear so a small subset can't farm", () => {
    expect(turnoutPoints(4, 4)).toBe(60);
    expect(turnoutPoints(2, 8)).toBe(4);
    expect(turnoutPoints(2, 8) * 4).toBeLessThan(turnoutPoints(8, 8));
  });
  it("speed rewards fast confirmation", () => {
    expect(speedPoints({ createdAt: "2026-03-01T10:00:00Z", confirmedAt: "2026-03-01T10:00:00Z" })).toBe(40);
    expect(speedPoints({ createdAt: "2026-03-01T00:00:00Z", confirmedAt: "2026-03-02T12:00:00Z" })).toBe(20);
    expect(speedPoints({ createdAt: "2026-03-01T00:00:00Z", confirmedAt: "2026-03-09T00:00:00Z" })).toBe(0);
    expect(speedPoints({ createdAt: "2026-03-01T00:00:00Z" })).toBe(0);
    expect(speedPoints(undefined)).toBe(0);
  });
  it("First Bloom is first log of an activity in the app that month", () => {
    const earlier = [log({ labels: ["kayak"], date: "2026-03-02" })];
    expect(isFirstBloom(log({ labels: ["Kayak"], date: "2026-03-20" }), earlier)).toBe(false);
    expect(isFirstBloom(log({ labels: ["kayak"], date: "2026-04-01" }), earlier)).toBe(true);
    expect(isFirstBloom(log({ labels: ["pottery"], date: "2026-03-20" }), earlier)).toBe(true);
  });
  it("detects holidays", () => {
    expect(holidayFor("2026-11-26")).toBe("Thanksgiving");
    expect(holidayFor("2026-12-24")).toBe("Christmas");
    expect(holidayFor("2026-03-10")).toBeNull();
  });
  it("totals factors, ordered rarity > turnout > speed > firstBloom > holiday at max", () => {
    const p = scoreLog(
      { cat: "water", labels: [], date: "2026-12-25", attendeeIds: ["a", "b", "c", "d"] },
      4,
      [],
      { createdAt: "2026-12-20T00:00:00Z", confirmedAt: "2026-12-20T00:00:00Z" },
    );
    expect(p).toMatchObject({ rarity: 85, turnout: 60, speed: 40, firstBloom: 30, holiday: 20, holidayName: "Christmas" });
    expect(p.total).toBe(235);
  });
});

describe("streaks and decay", () => {
  it("counts daily and weekly streaks", () => {
    const h = groupHealth(["2026-03-10", "2026-03-09", "2026-03-08", "2026-03-01", "2026-02-24"], "2026-03-10");
    expect(h.dailyStreak).toBe(3);
    expect(h.weeklyStreak).toBe(3);
    expect(h.streakBonus).toBe(15 + 45);
    expect(h.decay).toBe(0);
    expect(h.status).toBe("Thriving");
  });
  it("decays weekly, then monthly", () => {
    expect(decayPoints(3)).toBe(0);
    expect(decayPoints(14)).toBe(20);
    expect(decayPoints(65)).toBe(40 + 120);
  });
  it("decay removes leaves first, then shrinks the tree", () => {
    const fresh = groupHealth(["2026-03-10"], "2026-03-10");
    const idle = groupHealth(["2026-03-10"], "2026-05-10");
    expect(fresh.leaves).toBeGreaterThan(0);
    expect(fresh.shrink).toBe(1);
    expect(idle.leaves).toBe(0);
    expect(idle.shrink).toBeLessThan(1);
    expect(idle.status).toBe("Dormant");
  });
  it("group score never goes below zero and counts only members' logs", () => {
    const g = group();
    const logs = [log({ date: "2026-01-05" }), log({ authorId: "outsider", date: "2026-01-05" })];
    const s = groupScore(g, logs, "2026-06-01");
    expect(s.base).toBe(10);
    expect(s.total).toBe(0);
  });
});

describe("tree and boards", () => {
  it("grows by lifetime", () => {
    expect(stageFor(0)).toBe("Acorn");
    expect(stageFor(10)).toBe("Sprout");
    expect(stageFor(200)).toBe("Full canopy");
  });
  it("puts pairs on their own board", () => {
    const g4 = group({ id: "big" });
    const g2 = group({ id: "duo", memberIds: ["a", "b"] });
    const local = boardRows("local", [g4, g2], [], [], { region: "Boston, MA" });
    const duos = boardRows("duos", [g4, g2], [], [], {});
    expect(local.map((r) => r.id)).toEqual(["big"]);
    expect(duos.map((r) => r.id)).toEqual(["duo"]);
  });
  it("school board only includes that school's groups", () => {
    const rows = boardRows("school", [group({ school: "MIT" }), group({ id: "x", school: "Boston University" })], [], [], {
      school: "MIT",
    });
    expect(rows).toHaveLength(1);
  });
});
