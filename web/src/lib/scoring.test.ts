import { describe, expect, it } from "vitest";
import {
  BASE_POINTS,
  FIRST_TIME_BONUS,
  groupScore,
  holidayFor,
  leaderboard,
  organizationBonus,
  scoreActivity,
  treeFruit,
  treeStage,
} from "./scoring";
import type { ActivityLog, EventProposal, Group } from "./types";

const table = { coffee: 0.05, "axe throwing": 0.9 };

const log = (over: Partial<ActivityLog> = {}): ActivityLog => ({
  id: "l1",
  groupId: "g1",
  placeName: "Somewhere",
  category: "coffee",
  date: "2026-03-10",
  attendeeIds: ["u1"],
  emoji: "☕",
  ...over,
});

const group = (over: Partial<Group> = {}): Group => ({
  id: "g1",
  name: "G",
  location: "Boston",
  memberIds: ["u1"],
  createdAt: "2026-01-01",
  ...over,
});

describe("holidayFor", () => {
  it("detects Thanksgiving as 4th Thursday of November", () => {
    expect(holidayFor("2026-11-26")).toBe("Thanksgiving");
    expect(holidayFor("2026-11-19")).toBeNull();
  });
  it("detects Christmas season", () => {
    expect(holidayFor("2026-12-24")).toBe("Christmas");
  });
  it("returns null on ordinary days", () => {
    expect(holidayFor("2026-03-10")).toBeNull();
  });
});

describe("scoreActivity", () => {
  it("gives niche activities more points", () => {
    const common = scoreActivity(log(), [], table).total;
    const niche = scoreActivity(log({ category: "axe throwing" }), [], table).total;
    expect(niche).toBeGreaterThan(common);
  });
  it("awards first-time bonus only once per category", () => {
    const first = scoreActivity(log(), [], table);
    const second = scoreActivity(log({ id: "l2" }), [log()], table);
    expect(first.firstTime).toBe(FIRST_TIME_BONUS);
    expect(second.firstTime).toBe(0);
    expect(second.total).toBe(BASE_POINTS + 2); // round(0.05 * 40) = 2
  });
  it("applies holiday multiplier", () => {
    const s = scoreActivity(log({ date: "2026-12-25" }), [], table);
    expect(s.holiday).toBe("Christmas");
    expect(s.total).toBe(Math.round((BASE_POINTS + 2 + FIRST_TIME_BONUS) * 1.5));
  });
  it("defaults unknown categories to medium nicheness", () => {
    expect(scoreActivity(log({ category: "mystery" }), [], table).niche).toBe(20);
  });
});

describe("organizationBonus", () => {
  const ev = (createdAt: string, confirmedAt?: string): EventProposal => ({
    id: "e1",
    groupId: "g1",
    title: "Dinner",
    place: "X",
    proposedTime: "2026-03-12T17:00:00Z",
    createdAt,
    confirmedAt,
    status: confirmedAt ? "confirmed" : "open",
    votes: [],
  });
  it("rewards fast confirmation", () => {
    expect(organizationBonus(ev("2026-03-01T00:00:00Z", "2026-03-01T05:00:00Z"))).toBe(20);
    expect(organizationBonus(ev("2026-03-01T00:00:00Z", "2026-03-03T00:00:00Z"))).toBe(10);
    expect(organizationBonus(ev("2026-03-01T00:00:00Z", "2026-03-10T00:00:00Z"))).toBe(0);
    expect(organizationBonus(ev("2026-03-01T00:00:00Z"))).toBe(0);
  });
});

describe("leaderboard", () => {
  it("ranks by score and filters by location", () => {
    const groups = [group(), group({ id: "g2", location: "Cambridge" }), group({ id: "g3" })];
    const logs = [log(), log({ id: "l2", groupId: "g3", category: "axe throwing" })];
    const rows = leaderboard(groups, logs, [], table, { location: "Boston" });
    expect(rows.map((r) => r.group.id)).toEqual(["g3", "g1"]);
    expect(rows[0].rank).toBe(1);
    expect(groupScore("g2", logs, [], table)).toBe(0);
  });
});

describe("tree", () => {
  it("grows with age", () => {
    expect(treeStage(0)).toBe("acorn");
    expect(treeStage(10)).toBe("sprout");
    expect(treeStage(45)).toBe("sapling");
    expect(treeStage(200)).toBe("tree");
  });
  it("only bears fruit after 30 days", () => {
    const g = group({ createdAt: "2026-03-01" });
    expect(treeFruit(g, [log()], new Date("2026-03-15"))).toEqual([]);
    expect(treeFruit(g, [log()], new Date("2026-05-01"))).toEqual(["☕"]);
  });
});
