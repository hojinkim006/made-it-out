import type { ActivityLog, Group, State } from "./types";
import { groupScore, stageFor } from "./scoring";
import { daysBetween, todayISO } from "./dates";

export function groupInfo(state: State, g: Group, today = todayISO()) {
  const logs = state.logs.filter((l) => l.groupId === g.id).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const score = groupScore(g, state.logs, today);
  const ageDays = Math.max(0, daysBetween(g.createdAt, today));
  return { logs, score, ageDays, stage: stageFor(ageDays) };
}

export const since = (g: Group) =>
  new Date(g.createdAt + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });

export const myPoints = (logs: ActivityLog[], meId: string) =>
  logs.filter((l) => l.authorId === meId).reduce((a, l) => a + l.points.total, 0);
