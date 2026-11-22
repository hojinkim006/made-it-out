import { describe, expect, it } from "vitest";
import {
  acceptRequest,
  addTime,
  adjusted,
  comingTo,
  confirm,
  deadlineOf,
  declineAll,
  dropOut,
  extendVoting,
  handoff,
  hostOutAll,
  needOf,
  optLabel,
  optStatus,
  postPlan,
  ranked,
  recommended,
  setAnswer,
  setHostPick,
  tickPlans,
} from "./plans";
import type { State } from "./types";

const NOW = new Date("2026-03-10T12:00:00Z");

const state = (): State => ({
  version: 3,
  users: [],
  logs: [],
  groups: [
    {
      id: "g",
      name: "G",
      region: "Boston, MA",
      hood: "",
      createdAt: "2026-01-01",
      memberIds: ["a", "b", "c", "d"],
      plan: null,
      pastPlans: [],
      feed: [],
    },
  ],
});

const post = (s: State, auto = false, now = NOW) =>
  postPlan(
    s,
    "g",
    {
      id: "p",
      title: "Dinner",
      where: "North End",
      note: "",
      byId: "a",
      auto,
      options: [
        { id: "fri", date: "2026-03-20", time: "17:00" },
        { id: "sat", date: "2026-03-21", time: "18:00" },
      ],
    },
    now,
  );

const plan = (s: State) => s.groups[0].plan!;

describe("need", () => {
  it("asks for half the group, and at least 3 once the group is big enough", () => {
    expect(needOf(2)).toBe(2);
    expect(needOf(3)).toBe(3);
    expect(needOf(4)).toBe(3);
    expect(needOf(6)).toBe(3);
    expect(needOf(7)).toBe(4);
    expect(needOf(8)).toBe(4);
  });
});

describe("answers and ranking", () => {
  it("records the host as Yes on every time they post", () => {
    const s = state();
    post(s);
    const p = plan(s);
    expect(p.hostId).toBe("a");
    expect(p.options.map((o) => o.resp.a?.a)).toEqual(["yes", "yes"]);
    expect(s.groups[0].feed.at(-1)?.k).toBe("post");
  });

  it("scores Yes, Partly and If needed, and lets a repeat answer clear", () => {
    const s = state();
    post(s);
    setAnswer(s, "g", "b", "fri", "yes", {}, NOW);
    setAnswer(s, "g", "c", "fri", "part", { from: "18:30" }, NOW);
    setAnswer(s, "g", "d", "fri", "maybe", {}, NOW);
    const fri = plan(s).options[0];
    expect(comingTo(fri).sort()).toEqual(["a", "b", "c"]);
    expect(optStatus(4, plan(s), fri).ok).toBe(true);
    expect(setAnswer(s, "g", "b", "fri", "yes", {}, NOW)).toBe("cleared");
    expect(plan(s).options[0].resp.b).toBeUndefined();
  });

  it("will not recommend a time until the host is free and enough people can come", () => {
    const s = state();
    post(s);
    setAnswer(s, "g", "a", "fri", "no", {}, NOW);
    setAnswer(s, "g", "b", "fri", "yes", {}, NOW);
    setAnswer(s, "g", "c", "fri", "yes", {}, NOW);
    const fri = plan(s).options[0];
    expect(optStatus(4, plan(s), fri)).toMatchObject({ ok: false, code: "hostno" });
    expect(recommended(4, plan(s))).toBeNull();
    setAnswer(s, "g", "b", "sat", "yes", {}, NOW);
    setAnswer(s, "g", "c", "sat", "yes", {}, NOW);
    expect(recommended(4, plan(s))?.id).toBe("sat");
    setAnswer(s, "g", "a", "sat", "no", {}, NOW);
    expect(hostOutAll(plan(s))).toBe(true);
    expect(recommended(4, plan(s))).toBeNull();
  });

  it("ranks a viable time above a higher score, then the host's pick, then earlier", () => {
    const s = state();
    post(s);
    setAnswer(s, "g", "b", "sat", "yes", {}, NOW);
    setAnswer(s, "g", "c", "sat", "yes", {}, NOW);
    setAnswer(s, "g", "d", "sat", "yes", {}, NOW);
    setAnswer(s, "g", "b", "fri", "yes", {}, NOW);
    setAnswer(s, "g", "c", "fri", "yes", {}, NOW);
    expect(ranked(4, plan(s))[0].option.id).toBe("sat");
    setAnswer(s, "g", "d", "fri", "yes", {}, NOW);
    expect(ranked(4, plan(s)).map((r) => r.option.id)).toEqual(["fri", "sat"]);
    setHostPick(s, "g", "a", "sat");
    expect(ranked(4, plan(s)).map((r) => r.option.id)).toEqual(["sat", "fri"]);
  });

  it("shifts the start to the latest partial arrival, and rejects a window with no overlap", () => {
    const s = state();
    post(s);
    setAnswer(s, "g", "b", "fri", "part", { from: "18:30" }, NOW);
    setAnswer(s, "g", "c", "fri", "part", { from: "18:00", until: "19:00" }, NOW);
    expect(adjusted(plan(s).options[0])).toEqual({ start: "18:30", end: "19:00" });
    setAnswer(s, "g", "b", "fri", "part", { from: "20:00" }, NOW);
    expect(adjusted(plan(s).options[0])).toBeNull();
  });
});

describe("confirmation", () => {
  it("lets the host confirm a viable time and marks Yes and Partly as going", () => {
    const s = state();
    post(s);
    setAnswer(s, "g", "b", "fri", "yes", {}, NOW);
    setAnswer(s, "g", "c", "fri", "part", { from: "18:30" }, NOW);
    expect(confirm(s, "g", "b", "fri", "17:00", NOW)).toBe(false);
    expect(confirm(s, "g", "a", "fri", "18:30", NOW)).toBe(true);
    const p = plan(s);
    expect(p.confirmedOptionId).toBe("fri");
    expect(p.start).toBe("18:30");
    expect(p.goingIds.sort()).toEqual(["a", "b", "c"]);
    expect(p.confirmedAt).toBe(NOW.toISOString());
    expect(s.groups[0].feed.at(-1)?.k).toBe("confirm");
  });

  it("auto-confirms the recommended time only after the deadline, and only when auto is on", () => {
    const early = new Date("2026-03-10T10:00:00Z");
    const later = new Date("2026-03-11T11:00:00Z");
    const s = state();
    post(s, true, early);
    setAnswer(s, "g", "b", "fri", "yes", {}, early);
    setAnswer(s, "g", "c", "fri", "part", { from: "18:00" }, early);
    expect(tickPlans(s, early)).toEqual([]);
    expect(plan(s).confirmedOptionId).toBeNull();
    expect(tickPlans(s, later)).toEqual([`Auto-confirmed ${optLabel({ date: "2026-03-20", time: "18:00" })}`]);
    expect(plan(s).start).toBe("18:00");
    expect(s.groups[0].feed.at(-1)?.k).toBe("autoconf");

    const manual = state();
    post(manual, false, early);
    setAnswer(manual, "g", "b", "fri", "yes", {}, early);
    setAnswer(manual, "g", "c", "fri", "yes", {}, early);
    expect(tickPlans(manual, later)).toEqual([]);
  });

  it("closes voting at 24 hours, or 2 hours before the earliest time, and extensions push it", () => {
    const s = state();
    post(s);
    const posted = NOW.getTime();
    expect(deadlineOf(plan(s))).toBe(posted + 24 * 36e5);
    extendVoting(s, "g", "a", NOW);
    expect(deadlineOf(plan(s))).toBe(posted + 36 * 36e5);
    plan(s).options[0].date = "2026-03-10";
    plan(s).options[0].time = "18:00";
    const soon = new Date("2026-03-10T18:00:00").getTime() - 2 * 36e5;
    expect(deadlineOf(plan(s))).toBe(Math.min(posted + 36 * 36e5, soon));
  });

  it("reopens voting when too few people are still going", () => {
    const s = state();
    post(s);
    setAnswer(s, "g", "b", "fri", "yes", {}, NOW);
    setAnswer(s, "g", "c", "fri", "yes", {}, NOW);
    confirm(s, "g", "a", "fri", null, NOW);
    expect(dropOut(s, "g", "a", NOW)).toBe("host");
    expect(dropOut(s, "g", "b", NOW)).toBe("reopened");
    expect(plan(s).confirmedOptionId).toBeNull();
    expect(plan(s).confirmedAt).toBeUndefined();
    expect(plan(s).createdAt).toBe(NOW.toISOString());
  });

  it("hands off hosting, and a change request reopens voting with the new time", () => {
    const s = state();
    post(s);
    expect(handoff(s, "g", "a", "b", "Bea", NOW)).toBe("done");
    expect(plan(s).hostId).toBe("b");
    setAnswer(s, "g", "b", "fri", "yes", {}, NOW);
    setAnswer(s, "g", "c", "fri", "yes", {}, NOW);
    confirm(s, "g", "b", "fri", null, NOW);
    expect(addTime(s, "g", "d", "2026-03-22", "19:00", "req1", NOW)).toBe("request");
    expect(acceptRequest(s, "g", "c", "req1", "sun", NOW)).toBe(false);
    expect(acceptRequest(s, "g", "b", "req1", "sun", NOW)).toBe(true);
    const p = plan(s);
    expect(p.confirmedOptionId).toBeNull();
    expect(p.options.some((o) => o.id === "sun" && o.resp.d?.a === "yes" && o.resp.b?.a === "yes")).toBe(true);
  });

  it("marks every time as No, and saying Yes to an existing time does not add a duplicate", () => {
    const s = state();
    post(s);
    declineAll(s, "g", "d", NOW);
    expect(plan(s).options.every((o) => o.resp.d?.a === "no")).toBe(true);
    expect(addTime(s, "g", "b", "2026-03-20", "17:00", "dup", NOW)).toBe("dup");
    expect(plan(s).options).toHaveLength(2);
    expect(plan(s).options[0].resp.b?.a).toBe("yes");
  });
});
