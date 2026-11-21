import { estCost } from "./budget";
import type { AnswerKind, FeedItem, Group, Plan, State, TimeAnswer, TimeOption } from "./types";
import { fmtD, fmtT, parseD } from "./dates";

/**
 * How a time gets confirmed (from the v3 prototype):
 *   1. The host has to be free (Yes or Partly). A time the host hasn't answered can't win.
 *   2. At least `needOf(members)` people have to say Yes or Partly.
 *   3. Among times that clear both, the highest score wins
 *      (Yes 1, Partly 1/2, If needed 1/4, No 0).
 *   4. Ties go to the host's pick, then the earlier time.
 * Voting closes 24 hours after posting (plus any 12-hour extensions), or 2 hours
 * before the earliest option, whichever is sooner. If auto-confirm is on, the
 * recommended time locks itself in at that deadline.
 */

export const ANS: Record<AnswerKind, { label: string; w: number }> = {
  yes: { label: "Yes", w: 1 },
  part: { label: "Partly", w: 0.5 },
  maybe: { label: "If needed", w: 0.25 },
  no: { label: "No", w: 0 },
};

const HOUR = 36e5;
const nid = () => Math.random().toString(36).slice(2, 10);

export const isFree = (a?: AnswerKind) => a === "yes" || a === "part";

export function comingTo(o: TimeOption): string[] {
  return Object.keys(o.resp).filter((u) => isFree(o.resp[u]?.a));
}

export function optScore(o: TimeOption): number {
  return Object.values(o.resp).reduce((s, r) => s + ANS[r.a].w, 0);
}

/** Greater of "about half the group" and 3, never more than the group itself. */
export function needOf(memberCount: number): number {
  return Math.max(Math.min(3, memberCount), Math.ceil(memberCount / 2));
}

export const toMin = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
export const fromMin = (m: number) =>
  `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function optTime(o: Pick<TimeOption, "date" | "time">): number {
  return parseD(o.date).getTime() + toMin(o.time) * 60_000;
}

export function deadlineOf(p: Plan): number {
  const posted = new Date(p.createdAt).getTime();
  const caps = p.options.map((o) => optTime(o) - 2 * HOUR);
  return Math.min(posted + 24 * HOUR + (p.extMs || 0), ...(caps.length ? caps : [Infinity]));
}

export function fmtLeft(ms: number): string {
  const m = Math.max(0, Math.round(ms / 6e4));
  if (m >= 1440) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}

export function fmtScore(s: number): string {
  return s.toFixed(2).replace(/\.?0+$/, "");
}

export function optLabel(o: { date: string; time: string }): string {
  return `${fmtD(o.date, { weekday: "short", month: "short", day: "numeric" })} · ${fmtT(o.time)}`;
}

export function lateNote(r?: TimeAnswer): string {
  if (!r || r.a !== "part") return "";
  const bits = [r.from ? `after ${fmtT(r.from)}` : "", r.until ? `until ${fmtT(r.until)}` : ""].filter(Boolean);
  return bits.join(", ") || "for part of it";
}

export function relTime(t: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - t) / 6e4));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}

export interface OptStatus {
  ok: boolean;
  code: "host" | "hostno" | "need" | "ok";
  coming: number;
  need: number;
  hostAnswer?: AnswerKind;
}

export function optStatus(memberCount: number, p: Plan, o: TimeOption): OptStatus {
  const hostAnswer = o.resp[p.hostId]?.a;
  const coming = comingTo(o).length;
  const need = needOf(memberCount);
  if (!hostAnswer) return { ok: false, code: "host", coming, need };
  if (!isFree(hostAnswer)) return { ok: false, code: "hostno", coming, need, hostAnswer };
  if (coming < need) return { ok: false, code: "need", coming, need };
  return { ok: true, code: "ok", coming, need };
}

export function statusText(memberCount: number, st: OptStatus, hostLabel: string): string {
  if (st.code === "host") return `Waiting on ${hostLabel}`;
  if (st.code === "hostno") return `Host ${st.hostAnswer === "maybe" ? "only if needed" : "can't"}`;
  if (st.code === "need") return `${st.coming} of ${memberCount} · needs ${st.need - st.coming} more`;
  return `${st.coming} of ${memberCount} can come`;
}

export function hostPickId(p: Plan): string | undefined {
  return p.pickId || p.options.find((o) => o.byId === p.hostId)?.id;
}

export interface Ranked {
  option: TimeOption;
  index: number;
  status: OptStatus;
  score: number;
}

export function ranked(memberCount: number, p: Plan): Ranked[] {
  const pick = hostPickId(p);
  return p.options
    .map((option, index) => ({ option, index, status: optStatus(memberCount, p, option), score: optScore(option) }))
    .sort(
      (a, b) =>
        Number(b.status.ok) - Number(a.status.ok) ||
        b.score - a.score ||
        Number(b.option.id === pick) - Number(a.option.id === pick) ||
        optTime(a.option) - optTime(b.option) ||
        a.index - b.index,
    );
}

export function recommended(memberCount: number, p: Plan): TimeOption | null {
  const top = ranked(memberCount, p)[0];
  return top?.status.ok ? top.option : null;
}

export function confirmedOption(p: Plan): TimeOption | undefined {
  return p.options.find((o) => o.id === p.confirmedOptionId);
}

/** The time to show: the confirmed one, otherwise the current leader. */
export function activeOption(memberCount: number, p: Plan): TimeOption | undefined {
  return confirmedOption(p) ?? ranked(memberCount, p)[0]?.option;
}

export function eventWhen(p: Plan): { date: string; time: string } | null {
  const o = confirmedOption(p);
  if (!o) return null;
  return { date: o.date, time: p.start || o.time };
}

export interface Adjustment {
  start: string;
  end: string | null;
}

/**
 * If anyone coming is only partly free and arrives after the posted time,
 * shift the start to the latest arrival. Returns null when that leaves no overlap.
 */
export function adjusted(o: TimeOption): Adjustment | null {
  let start = toMin(o.time);
  let end: number | null = null;
  for (const id of comingTo(o)) {
    const r = o.resp[id];
    if (r?.a !== "part") continue;
    if (r.from && toMin(r.from) > start) start = toMin(r.from);
    if (r.until) end = end == null ? toMin(r.until) : Math.min(end, toMin(r.until));
  }
  if (end != null && end <= start) return null;
  if (start === toMin(o.time)) return null;
  return { start: fromMin(start), end: end != null ? fromMin(end) : null };
}

export const answeredAny = (p: Plan, userId: string) => p.options.some((o) => o.resp[userId]);
export const responded = (p: Plan, userId: string) => !!p.confirmedOptionId || answeredAny(p, userId);
export const waitingIds = (memberIds: string[], p: Plan) => memberIds.filter((u) => !answeredAny(p, u));
export const needsHost = (p: Plan) => (p.confirmedOptionId ? [] : p.options.filter((o) => !o.resp[p.hostId]));
export const hostOutAll = (p: Plan) =>
  !p.confirmedOptionId && p.options.length > 0 && p.options.every((o) => o.resp[p.hostId] && !isFree(o.resp[p.hostId].a));

export function feedText(f: FeedItem): string {
  switch (f.k) {
    case "post":
      return `posted “${f.title}” for ${f.opt}`;
    case "resp":
      return `said ${f.ans} to ${f.opt}`;
    case "nonall":
      return "can't make any of the times";
    case "suggest":
      return `suggested a new time: ${f.opt}`;
    case "confirm":
      return `confirmed ${f.opt}`;
    case "autoconf":
      return `auto-confirmed ${f.opt} when voting closed`;
    case "reopen":
      return `reopened voting${f.why ? ` (${f.why})` : ""}`;
    case "request":
      return `asked to move it to ${f.opt}`;
    case "reqyes":
      return `added ${f.opt} and reopened voting`;
    case "reqno":
      return "kept the confirmed time";
    case "join":
      return "will make it after all";
    case "drop":
      return "can't make it anymore";
    case "handoff":
      return `handed hosting to ${f.to}`;
    case "cancel":
      return `canceled “${f.title}”`;
    case "extend":
      return "extended voting by 12 hours";
    case "comment": {
      const text = f.text ?? "";
      return `commented on “${f.title}”: ${text.length > 60 ? `${text.slice(0, 58)}…` : text}`;
    }
    case "rate":
      return `rated “${f.title}” ${f.n}★`;
    default:
      return "";
  }
}

function planOf(s: State, groupId: string): [Group, Plan] | null {
  const g = s.groups.find((x) => x.id === groupId);
  return g?.plan ? [g, g.plan] : null;
}

function push(g: Group, byId: string, item: Omit<FeedItem, "id" | "t" | "byId">, now: Date) {
  g.feed.push({ id: nid(), t: now.getTime(), byId, ...item });
  if (g.feed.length > 50) g.feed.splice(0, g.feed.length - 50);
}

function applyConfirm(g: Group, p: Plan, o: TimeOption, start: string, auto: boolean, now: Date) {
  p.confirmedOptionId = o.id;
  p.start = start || o.time;
  p.goingIds = comingTo(o);
  p.requests = [];
  p.confirmedAt = now.toISOString();
  push(g, p.hostId, { k: auto ? "autoconf" : "confirm", opt: optLabel({ date: o.date, time: p.start }) }, now);
}

function reopen(g: Group, p: Plan, why: string, byId: string, now: Date) {
  p.confirmedOptionId = null;
  p.goingIds = [];
  p.start = null;
  p.confirmedAt = undefined;
  p.createdAt = now.toISOString();
  p.extMs = 0;
  push(g, byId, { k: "reopen", why }, now);
}

export interface NewOption {
  id: string;
  date: string;
  time: string;
}

/** Host posts the event. Their Yes is recorded on every time they offer. */
export function postPlan(
  s: State,
  groupId: string,
  plan: {
    id: string;
    title: string;
    where: string;
    note: string;
    placeId?: string;
    byId: string;
    auto: boolean;
    price?: number | null;
    options: NewOption[];
  },
  now = new Date(),
) {
  const g = s.groups.find((x) => x.id === groupId);
  if (!g || !plan.options.length) return;
  if (g.plan) g.pastPlans.push(g.plan);
  const yes: TimeAnswer = { a: "yes" };
  g.plan = {
    id: plan.id,
    groupId,
    title: plan.title,
    where: plan.where,
    note: plan.note,
    placeId: plan.placeId,
    price: plan.price ?? null,
    est: estCost(plan.title, plan.where),
    byId: plan.byId,
    hostId: plan.byId,
    createdAt: now.toISOString(),
    extMs: 0,
    auto: plan.auto,
    pickId: null,
    confirmedOptionId: null,
    start: null,
    goingIds: [],
    requests: [],
    options: plan.options.map((o) => ({ ...o, byId: plan.byId, resp: { [plan.byId]: { ...yes } } })),
  };
  push(g, plan.byId, { k: "post", title: plan.title, opt: optLabel(plan.options[0]) }, now);
}

/** Set or clear one person's answer on one time. Same answer again clears it, except Partly. */
export function setAnswer(
  s: State,
  groupId: string,
  userId: string,
  optionId: string,
  answer: AnswerKind,
  extra: { from?: string; until?: string } = {},
  now = new Date(),
): "set" | "cleared" | "noop" {
  const gp = planOf(s, groupId);
  if (!gp) return "noop";
  const [g, p] = gp;
  if (p.confirmedOptionId) return "noop";
  const o = p.options.find((x) => x.id === optionId);
  if (!o) return "noop";
  if (o.resp[userId]?.a === answer && answer !== "part") {
    delete o.resp[userId];
    return "cleared";
  }
  const saved: TimeAnswer = { a: answer, ...(extra.from ? { from: extra.from } : {}), ...(extra.until ? { until: extra.until } : {}) };
  o.resp[userId] = saved;
  const ans = answer === "part" ? `Partly (${lateNote(saved)})` : ANS[answer].label;
  push(g, userId, { k: "resp", ans, opt: optLabel(o) }, now);
  return "set";
}

export function declineAll(s: State, groupId: string, userId: string, now = new Date()) {
  const gp = planOf(s, groupId);
  if (!gp || gp[1].confirmedOptionId) return;
  const [g, p] = gp;
  for (const o of p.options) o.resp[userId] = { a: "no" };
  push(g, userId, { k: "nonall" }, now);
}

export function setHostPick(s: State, groupId: string, actorId: string, optionId: string) {
  const p = planOf(s, groupId)?.[1];
  if (!p || p.hostId !== actorId || p.confirmedOptionId) return;
  if (!p.options.some((o) => o.id === optionId)) return;
  p.pickId = optionId;
}

export function setAuto(s: State, groupId: string, actorId: string, auto: boolean) {
  const p = planOf(s, groupId)?.[1];
  if (!p || p.hostId !== actorId) return;
  p.auto = auto;
}

export function extendVoting(s: State, groupId: string, actorId: string, now = new Date()) {
  const gp = planOf(s, groupId);
  if (!gp) return;
  const [g, p] = gp;
  if (p.hostId !== actorId || p.confirmedOptionId) return;
  p.extMs += 12 * HOUR;
  push(g, actorId, { k: "extend" }, now);
}

export function confirm(
  s: State,
  groupId: string,
  actorId: string,
  optionId: string,
  start: string | null,
  now = new Date(),
): boolean {
  const gp = planOf(s, groupId);
  if (!gp) return false;
  const [g, p] = gp;
  if (p.hostId !== actorId || p.confirmedOptionId) return false;
  const o = p.options.find((x) => x.id === optionId);
  if (!o || !optStatus(g.memberIds.length, p, o).ok) return false;
  applyConfirm(g, p, o, start || o.time, false, now);
  return true;
}

export function addTime(s: State, groupId: string, userId: string, date: string, time: string, id: string, now = new Date()): "request" | "dup" | "added" | "noop" {
  const gp = planOf(s, groupId);
  if (!gp) return "noop";
  const [g, p] = gp;
  if (p.confirmedOptionId) {
    p.requests.push({ id, byId: userId, date, time });
    push(g, userId, { k: "request", opt: optLabel({ date, time }) }, now);
    return "request";
  }
  const dup = p.options.find((o) => o.date === date && o.time === time);
  if (dup) {
    dup.resp[userId] = { a: "yes" };
    return "dup";
  }
  p.options.push({ id, byId: userId, date, time, resp: { [userId]: { a: "yes" } } });
  push(g, userId, { k: "suggest", opt: optLabel({ date, time }) }, now);
  return "added";
}

export function acceptRequest(s: State, groupId: string, actorId: string, requestId: string, optionId: string, now = new Date()): boolean {
  const gp = planOf(s, groupId);
  if (!gp) return false;
  const [g, p] = gp;
  if (p.hostId !== actorId) return false;
  const r = p.requests.find((x) => x.id === requestId);
  if (!r) return false;
  p.requests = p.requests.filter((x) => x.id !== requestId);
  p.options.push({
    id: optionId,
    byId: r.byId,
    date: r.date,
    time: r.time,
    resp: { [r.byId]: { a: "yes" }, [actorId]: { a: "yes" } },
  });
  push(g, actorId, { k: "reqyes", opt: optLabel(r) }, now);
  reopen(g, p, "new time added", actorId, now);
  return true;
}

export function declineRequest(s: State, groupId: string, actorId: string, requestId: string, now = new Date()): boolean {
  const gp = planOf(s, groupId);
  if (!gp) return false;
  const [g, p] = gp;
  if (p.hostId !== actorId) return false;
  if (!p.requests.some((x) => x.id === requestId)) return false;
  p.requests = p.requests.filter((x) => x.id !== requestId);
  push(g, actorId, { k: "reqno" }, now);
  return true;
}

export function joinLate(s: State, groupId: string, userId: string, now = new Date()) {
  const gp = planOf(s, groupId);
  if (!gp) return;
  const [g, p] = gp;
  if (!p.confirmedOptionId || p.goingIds.includes(userId)) return;
  p.goingIds.push(userId);
  push(g, userId, { k: "join" }, now);
}

export function dropOut(s: State, groupId: string, userId: string, now = new Date()): "host" | "reopened" | "dropped" | "noop" {
  const gp = planOf(s, groupId);
  if (!gp || !gp[1].confirmedOptionId) return "noop";
  const [g, p] = gp;
  if (p.hostId === userId) return "host";
  if (!p.goingIds.includes(userId)) return "noop";
  push(g, userId, { k: "drop" }, now);
  p.goingIds = p.goingIds.filter((u) => u !== userId);
  if (p.goingIds.length < needOf(g.memberIds.length)) {
    reopen(g, p, `only ${p.goingIds.length} going`, userId, now);
    return "reopened";
  }
  return "dropped";
}

export function handoff(s: State, groupId: string, actorId: string, newHostId: string, newHostName: string, now = new Date()): "reopened" | "done" | "noop" {
  const gp = planOf(s, groupId);
  if (!gp) return "noop";
  const [g, p] = gp;
  if (p.hostId !== actorId || newHostId === actorId || !g.memberIds.includes(newHostId)) return "noop";
  const old = p.hostId;
  p.hostId = newHostId;
  push(g, actorId, { k: "handoff", to: newHostName }, now);
  if (p.confirmedOptionId && p.goingIds.includes(old)) {
    push(g, actorId, { k: "drop" }, now);
    p.goingIds = p.goingIds.filter((u) => u !== old);
    if (p.goingIds.length < needOf(g.memberIds.length)) {
      reopen(g, p, `only ${p.goingIds.length} going`, actorId, now);
      return "reopened";
    }
  }
  return "done";
}

export function reopenVoting(s: State, groupId: string, actorId: string, now = new Date()) {
  const gp = planOf(s, groupId);
  if (!gp) return;
  const [g, p] = gp;
  if (p.hostId !== actorId || !p.confirmedOptionId) return;
  reopen(g, p, "host is changing the time", actorId, now);
}

export function cancelPlan(s: State, groupId: string, actorId: string, now = new Date()) {
  const g = s.groups.find((x) => x.id === groupId);
  const p = g?.plan;
  if (!g || !p || p.hostId !== actorId) return;
  push(g, actorId, { k: "cancel", title: p.title }, now);
  g.plan = null;
}

/** Lock the recommended time once voting has closed, for plans with auto-confirm on. */
export function tickPlans(s: State, now = new Date()): string[] {
  const notes: string[] = [];
  for (const g of s.groups) {
    const p = g.plan;
    if (!p || p.confirmedOptionId || !p.auto) continue;
    if (now.getTime() < deadlineOf(p)) continue;
    const o = recommended(g.memberIds.length, p);
    if (!o) continue;
    const shift = adjusted(o);
    applyConfirm(g, p, o, shift ? shift.start : o.time, true, now);
    notes.push(`Auto-confirmed ${optLabel({ date: o.date, time: p.start || o.time })}`);
  }
  return notes;
}
