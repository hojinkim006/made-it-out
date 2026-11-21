import type { Group, Plan, State } from "./types";

export type MemberStatus = "in" | "out" | "suggested" | "waiting";

export function memberStatus(p: Plan, userId: string): MemberStatus {
  if (p.inIds.includes(userId)) return "in";
  if (p.outIds.includes(userId)) return "out";
  if (p.suggestions.some((s) => s.byId === userId || s.voterIds.includes(userId))) return "suggested";
  return "waiting";
}

const planOf = (s: State, groupId: string): [Group, Plan] | null => {
  const g = s.groups.find((x) => x.id === groupId);
  return g?.plan ? [g, g.plan] : null;
};

/** Locks the plan in automatically once every member has accepted the current time. */
function autoConfirm(g: Group, p: Plan, now: Date) {
  if (!p.confirmedAt && g.memberIds.every((m) => p.inIds.includes(m))) p.confirmedAt = now.toISOString();
}

export function postPlan(s: State, groupId: string, plan: Omit<Plan, "inIds" | "outIds" | "suggestions" | "createdAt" | "groupId">, now = new Date()) {
  const g = s.groups.find((x) => x.id === groupId)!;
  if (g.plan) g.pastPlans.push(g.plan);
  g.plan = { ...plan, groupId, createdAt: now.toISOString(), inIds: [plan.byId], outIds: [], suggestions: [] };
}

export function respond(s: State, groupId: string, userId: string, answer: "in" | "out" | "clear", now = new Date()) {
  const gp = planOf(s, groupId);
  if (!gp) return;
  const [g, p] = gp;
  p.inIds = p.inIds.filter((x) => x !== userId);
  p.outIds = p.outIds.filter((x) => x !== userId);
  if (answer === "in") p.inIds.push(userId);
  if (answer === "out") p.outIds.push(userId);
  autoConfirm(g, p, now);
}

export function suggestTime(s: State, groupId: string, userId: string, date: string, time: string, id: string) {
  const gp = planOf(s, groupId);
  if (!gp) return;
  const [, p] = gp;
  const same = p.suggestions.find((x) => x.date === date && x.time === time);
  if (same) {
    if (!same.voterIds.includes(userId)) same.voterIds.push(userId);
    return;
  }
  p.suggestions.push({ id, byId: userId, date, time, voterIds: [userId] });
}

export function toggleVote(s: State, groupId: string, userId: string, suggestionId: string) {
  const sug = planOf(s, groupId)?.[1].suggestions.find((x) => x.id === suggestionId);
  if (!sug) return;
  sug.voterIds = sug.voterIds.includes(userId) ? sug.voterIds.filter((x) => x !== userId) : [...sug.voterIds, userId];
}

/** Proposer switches the plan to a suggested time; its voters become "in". */
export function adoptSuggestion(s: State, groupId: string, suggestionId: string, now = new Date()) {
  const gp = planOf(s, groupId);
  if (!gp) return;
  const [g, p] = gp;
  const sug = p.suggestions.find((x) => x.id === suggestionId);
  if (!sug) return;
  p.date = sug.date;
  p.time = sug.time;
  p.inIds = [...new Set([p.byId, ...sug.voterIds])];
  p.outIds = [];
  p.confirmedAt = undefined;
  p.suggestions = p.suggestions.filter((x) => x.id !== suggestionId);
  autoConfirm(g, p, now);
}

export function lockIn(s: State, groupId: string, now = new Date()) {
  const p = planOf(s, groupId)?.[1];
  if (p && !p.confirmedAt) p.confirmedAt = now.toISOString();
}

export function cancelPlan(s: State, groupId: string) {
  const g = s.groups.find((x) => x.id === groupId);
  if (g) g.plan = null;
}
