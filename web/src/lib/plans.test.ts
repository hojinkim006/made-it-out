import { describe, expect, it } from "vitest";
import { adoptSuggestion, lockIn, memberStatus, postPlan, respond, suggestTime, toggleVote } from "./plans";
import type { State } from "./types";

const state = (): State => ({
  version: 2,
  users: [],
  logs: [],
  groups: [{ id: "g", name: "G", region: "Boston, MA", hood: "", createdAt: "2026-01-01", memberIds: ["a", "b", "c", "d"], plan: null, pastPlans: [] }],
});

const post = (s: State) =>
  postPlan(s, "g", { id: "p", title: "Dinner", where: "", date: "2026-03-20", time: "17:00", note: "", byId: "a" }, new Date("2026-03-10T10:00:00Z"));

describe("plans (4-screen demo flow)", () => {
  it("poster is in, others are waiting", () => {
    const s = state();
    post(s);
    const p = s.groups[0].plan!;
    expect(memberStatus(p, "a")).toBe("in");
    expect(memberStatus(p, "c")).toBe("waiting");
  });
  it("accept, ignore, and suggest a new time", () => {
    const s = state();
    post(s);
    respond(s, "g", "b", "in");
    suggestTime(s, "g", "d", "2026-03-21", "18:00", "s1");
    const p = s.groups[0].plan!;
    expect(memberStatus(p, "b")).toBe("in");
    expect(memberStatus(p, "c")).toBe("waiting");
    expect(memberStatus(p, "d")).toBe("suggested");
    toggleVote(s, "g", "b", "s1");
    expect(p.suggestions[0].voterIds).toEqual(["d", "b"]);
  });
  it("auto-confirms when everyone is in", () => {
    const s = state();
    post(s);
    for (const m of ["b", "c", "d"]) respond(s, "g", m, "in", new Date("2026-03-10T12:00:00Z"));
    expect(s.groups[0].plan!.confirmedAt).toBe("2026-03-10T12:00:00.000Z");
  });
  it("adopting a suggestion moves the plan and resets answers", () => {
    const s = state();
    post(s);
    respond(s, "g", "c", "out");
    suggestTime(s, "g", "d", "2026-03-21", "18:00", "s1");
    adoptSuggestion(s, "g", "s1");
    const p = s.groups[0].plan!;
    expect([p.date, p.time]).toEqual(["2026-03-21", "18:00"]);
    expect(p.inIds.sort()).toEqual(["a", "d"]);
    expect(p.outIds).toEqual([]);
    expect(p.suggestions).toEqual([]);
  });
  it("proposer can lock it in early", () => {
    const s = state();
    post(s);
    lockIn(s, "g", new Date("2026-03-10T11:00:00Z"));
    expect(s.groups[0].plan!.confirmedAt).toBeDefined();
  });
});
