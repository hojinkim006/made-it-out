import type { PostgrestError } from "@supabase/supabase-js";
import { MEDIA_BUCKET, supabase } from "./supabase";
import { STATE_VERSION } from "./data/seed";
import type { ActivityLog, Cat, FeedItem, Group, Plan, State, User } from "./lib/types";

/*
 * Everything that talks to the Supabase database. The rest of the app keeps
 * working with the plain State shape from lib/types.ts.
 */

interface ProfileRow {
  id: string;
  username: string;
  display_name: string;
  region: string;
  school: string | null;
}

export interface GroupRow {
  id: string;
  name: string;
  region: string;
  hood: string;
  school: string | null;
  created_at: string;
  plan: Plan | null;
  past_plans: Plan[] | null;
  feed: FeedItem[] | null;
  version: number;
}

export interface LogRow {
  id: string;
  group_id: string;
  author_id: string;
  date: string;
  cat: string;
  labels: string[];
  points_total: number;
  data: ActivityLog;
  version: number;
}

interface MemberRow {
  group_id: string;
  user_id: string;
}

/** What the database has, plus the row version of each group ("g:id") and log ("l:id"). */
export interface Snapshot {
  state: State;
  ver: Map<string, number>;
}

/** Every group and log in the app, summary fields only. For leaderboards and the First Bloom bonus. */
export interface Board {
  groups: Group[];
  logs: ActivityLog[];
}

export const emptyState = (): State => ({ version: STATE_VERSION, users: [], groups: [], logs: [] });

const PROFILE_COLS = "id, username, display_name, region, school";

function ok<T>(res: { data: T | null; error: PostgrestError | Error | null }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

export const toUser = (p: ProfileRow): User => ({
  id: p.id,
  username: p.username,
  email: "",
  phone: "",
  displayName: p.display_name,
  region: p.region,
  school: p.school ?? undefined,
  friendIds: [],
});

export const toGroup = (r: GroupRow, memberIds: string[]): Group => ({
  id: r.id,
  name: r.name,
  region: r.region,
  hood: r.hood,
  school: r.school ?? undefined,
  createdAt: r.created_at,
  memberIds,
  plan: r.plan,
  pastPlans: r.past_plans ?? [],
  feed: r.feed ?? [],
});

export const toLog = (r: LogRow): ActivityLog => ({ ...r.data, id: r.id, groupId: r.group_id, authorId: r.author_id });

export async function loadProfiles(ids: string[]): Promise<User[]> {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  return ok(await supabase.from("profiles").select(PROFILE_COLS).in("id", unique)).map(toUser);
}

/** Load groups with their members and logs. Groups the user can't see are simply missing. */
export async function loadGroups(ids: string[]): Promise<{ groups: Group[]; logs: ActivityLog[]; ver: [string, number][] }> {
  if (!ids.length) return { groups: [], logs: [], ver: [] };
  const [g, m, l] = await Promise.all([
    supabase.from("groups").select("*").in("id", ids),
    supabase.from("group_members").select("group_id, user_id").in("group_id", ids).order("joined_at"),
    supabase.from("logs").select("*").in("group_id", ids),
  ]);
  const rows = ok<GroupRow[]>(g);
  const members = ok<MemberRow[]>(m);
  const logs = ok<LogRow[]>(l);
  const memberIds = (id: string) => members.filter((x) => x.group_id === id).map((x) => x.user_id);
  return {
    groups: rows.map((r) => toGroup(r, memberIds(r.id))),
    logs: logs.map(toLog),
    ver: [...rows.map((r): [string, number] => [`g:${r.id}`, r.version]), ...logs.map((r): [string, number] => [`l:${r.id}`, r.version])],
  };
}

/** Everything the signed-in user can see. */
export async function loadAll(userId: string, email: string): Promise<Snapshot> {
  const [profile, priv, friends, mine] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLS).eq("id", userId).maybeSingle(),
    supabase.from("private_profiles").select("phone, school_email").eq("id", userId).maybeSingle(),
    supabase.from("friendships").select("friend_id").eq("user_id", userId),
    supabase.from("group_members").select("group_id").eq("user_id", userId),
  ]);
  const p = ok<ProfileRow | null>(profile);
  if (!p) throw new Error("Your profile is missing. Was the database migration run before you signed up?");
  const pv = ok<{ phone: string | null; school_email: string | null } | null>(priv);
  const friendIds = ok<{ friend_id: string }[]>(friends).map((f) => f.friend_id);
  const groupIds = ok<{ group_id: string }[]>(mine).map((x) => x.group_id);

  const loaded = await loadGroups(groupIds);
  const others = await loadProfiles([...friendIds, ...loaded.groups.flatMap((g) => g.memberIds)].filter((id) => id !== userId));
  const me: User = { ...toUser(p), email, phone: pv?.phone ?? "", schoolEmail: pv?.school_email ?? undefined, friendIds };
  return {
    state: { ...emptyState(), users: [me, ...others], groups: loaded.groups, logs: loaded.logs },
    ver: new Map(loaded.ver),
  };
}

export async function loadBoard(): Promise<Board> {
  const data = ok<{
    groups: { id: string; name: string; region: string; hood: string; school: string | null; createdAt: string; memberIds: string[] }[];
    logs: { id: string; groupId: string; authorId: string; date: string; cat: Cat; labels: string[]; pts: number }[];
  }>(await supabase.rpc("board"));
  return {
    groups: data.groups.map((g) => ({ ...g, school: g.school ?? undefined, plan: null, pastPlans: [], feed: [] })),
    logs: data.logs.map((l) => ({
      id: l.id,
      groupId: l.groupId,
      authorId: l.authorId,
      date: l.date,
      cat: l.cat,
      labels: l.labels,
      title: "",
      description: "",
      emoji: "",
      where: "",
      attendeeIds: [],
      media: [],
      price: null,
      est: null,
      ratings: {},
      comments: [],
      points: { rarity: 0, turnout: 0, speed: 0, firstBloom: 0, holiday: 0, holidayName: null, total: l.pts },
    })),
  };
}

/** Re-read some groups and logs after a write conflict, replacing them in the snapshot. */
export async function refetch(snap: Snapshot, ids: { groups: string[]; logs: string[] }): Promise<void> {
  if (ids.groups.length) {
    const fresh = await loadGroups(ids.groups);
    snap.state.groups = [...snap.state.groups.filter((g) => !ids.groups.includes(g.id)), ...fresh.groups];
    snap.state.logs = [...snap.state.logs.filter((l) => !ids.groups.includes(l.groupId)), ...fresh.logs];
    for (const [k, v] of fresh.ver) snap.ver.set(k, v);
    await addMissingProfiles(snap);
  }
  if (ids.logs.length) {
    const rows = ok<LogRow[]>(await supabase.from("logs").select("*").in("id", ids.logs));
    snap.state.logs = [...snap.state.logs.filter((l) => !ids.logs.includes(l.id)), ...rows.map(toLog)];
    for (const r of rows) snap.ver.set(`l:${r.id}`, r.version);
  }
}

/** Fetch profiles for any group member we don't know yet. */
export async function addMissingProfiles(snap: Snapshot): Promise<void> {
  const known = new Set(snap.state.users.map((u) => u.id));
  const missing = snap.state.groups.flatMap((g) => g.memberIds).filter((id) => !known.has(id));
  if (missing.length) snap.state.users.push(...(await loadProfiles(missing)));
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const groupContent = (g: Group) => [g.name, g.hood, g.plan, g.pastPlans, g.feed];

/** Logs keyed by id, last one wins (a retried change can push the same log twice). */
const byId = (logs: ActivityLog[]) => new Map(logs.map((l) => [l.id, l]));

/** True when the draft differs from the base in anything that gets saved. */
export function hasChanges(base: State, draft: State): boolean {
  return !same(base.groups, draft.groups) || !same(base.logs, draft.logs);
}

export type PushResult = null | { groups: string[]; logs: string[] };

/**
 * Save every group and log that differs between the snapshot and the draft.
 * Each successful write is copied into the snapshot right away. Returns null when
 * everything saved, or the rows someone else changed first (a conflict).
 * Throws on any other error (permissions, network, validation).
 */
export async function pushDiff(snap: Snapshot, draft: State, meId: string): Promise<PushResult> {
  for (const g of draft.groups) {
    let base = snap.state.groups.find((x) => x.id === g.id);
    if (!base) {
      ok(
        await supabase.rpc("create_group", {
          p_id: g.id,
          p_name: g.name,
          p_region: g.region,
          p_hood: g.hood,
          p_school: g.school ?? null,
          p_created_at: g.createdAt,
          p_member_ids: g.memberIds.filter((id) => id !== meId),
        }),
      );
      base = { ...g, plan: null, pastPlans: [], feed: [] };
      snap.state.groups.push(base);
      snap.ver.set(`g:${g.id}`, 0);
    }
    const added = g.memberIds.filter((id) => !base.memberIds.includes(id));
    if (added.length) {
      ok(await supabase.rpc("add_group_members", { p_group: g.id, p_user_ids: added }));
      base.memberIds = [...base.memberIds, ...added];
    }
    if (!same(groupContent(base), groupContent(g))) {
      const v = snap.ver.get(`g:${g.id}`) ?? 0;
      const rows = ok(
        await supabase
          .from("groups")
          .update({ name: g.name, hood: g.hood, plan: g.plan, past_plans: g.pastPlans, feed: g.feed, version: v + 1, updated_at: new Date().toISOString() })
          .eq("id", g.id)
          .eq("version", v)
          .select("version"),
      );
      if (!rows.length) return { groups: [g.id], logs: [] };
      Object.assign(base, structuredClone({ name: g.name, hood: g.hood, plan: g.plan, pastPlans: g.pastPlans, feed: g.feed }));
      snap.ver.set(`g:${g.id}`, v + 1);
    }
  }

  const baseLogs = byId(snap.state.logs);
  for (const l of byId(draft.logs).values()) {
    const base = baseLogs.get(l.id);
    if (base && same(base, l)) continue;
    const cols = { date: l.date, cat: l.cat, labels: l.labels, points_total: l.points.total, data: l };
    if (!base) {
      const res = await supabase.from("logs").insert({ id: l.id, group_id: l.groupId, author_id: l.authorId, version: 0, ...cols });
      if (res.error?.code === "23505") return { groups: [], logs: [l.id] }; // already saved
      ok(res);
      snap.state.logs.push(structuredClone(l));
      snap.ver.set(`l:${l.id}`, 0);
    } else {
      const v = snap.ver.get(`l:${l.id}`) ?? 0;
      const rows = ok(await supabase.from("logs").update({ ...cols, version: v + 1 }).eq("id", l.id).eq("version", v).select("version"));
      if (!rows.length) return { groups: [], logs: [l.id] };
      snap.state.logs = snap.state.logs.map((x) => (x.id === l.id ? structuredClone(l) : x));
      snap.ver.set(`l:${l.id}`, v + 1);
    }
  }
  return null;
}

/** Upload a photo or video for a log and return its public URL. */
export async function uploadMedia(groupId: string, logId: string, mediaId: string, blob: Blob): Promise<string> {
  const ext = (blob.type.split("/")[1] || "bin").replace("quicktime", "mov").replace("jpeg", "jpg");
  const path = `${groupId}/${logId}/${mediaId}.${ext}`;
  ok(await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, { contentType: blob.type, upsert: true }));
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** A readable message for a database error, including the codes our SQL functions raise. */
export function errorText(e: unknown): string {
  const err = e as { message?: string; code?: string };
  const msg = err?.message ?? String(e);
  const known: Record<string, string> = {
    not_friends: "You can only add people who are your friends",
    bad_group_size: "Groups have 2–8 people",
    group_full: "That group is full",
    not_member: "You're not in that group anymore",
    not_signed_in: "Your session ended. Log in again.",
    too_many_attempts: "Too many tries. Wait 15 minutes and try again.",
  };
  if (known[msg]) return known[msg];
  if (err?.code === "23505") return "That's already taken";
  if (/fetch|network/i.test(msg)) return "Can't reach the server. Check your connection.";
  return msg;
}
