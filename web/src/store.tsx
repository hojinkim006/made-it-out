import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ActivityLog, Group, State, User } from "./lib/types";
import { feedText, tickPlans } from "./lib/plans";
import { digits } from "./lib/auth";
import { supabase } from "./supabase";
import {
  addMissingProfiles,
  emptyState,
  errorText,
  hasChanges,
  loadAll,
  loadBoard,
  loadGroups,
  loadProfiles,
  pushDiff,
  refetch,
  toGroup,
  toLog,
  toUser,
  type Board,
  type GroupRow,
  type LogRow,
  type Snapshot,
} from "./db";

/*
 * App state backed by Supabase.
 *
 * `server` holds what the database has. Every update(fn) is applied on screen
 * right away (optimistic), queued, then saved by re-running fn on the latest
 * server copy. If someone else saved the same group or log first, the row is
 * re-read and fn runs again on top of their change. Realtime pushes other
 * people's changes into `server`, and the screen is rebuilt as
 * server + changes still waiting to save.
 */

type Mutation = (draft: State) => void;
/** A Realtime row change. `new` is the row after the change (empty for deletes). */
type Change = { new: object };
export type Status = "loading" | "signedOut" | "ready" | "error";

/** Random id. UUIDs, because groups, logs and media paths are uuid columns. */
export function uid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // randomUUID only exists on https/localhost; same v4 format for plain-http LAN testing.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

interface Toast {
  id: number;
  text: string;
}

export interface ProfilePatch {
  displayName?: string;
  region?: string;
  school?: string | null;
  schoolEmail?: string | null;
  phone?: string;
}

interface Store {
  status: Status;
  /** Why loading failed, when status is "error". */
  error: string;
  state: State;
  /** Every group and log in the app (summary fields), with my own groups up to date. */
  board: Board;
  me: User | null;
  /** Change state. Shows immediately and saves in the background. */
  update: (fn: Mutation) => boolean;
  /** Save my profile. Resolves to an error message, or null when saved. */
  saveProfile: (patch: ProfilePatch) => Promise<string | null>;
  /** Add a friend by username. Resolves to an error message, or the friend. */
  addFriend: (username: string) => Promise<{ error: string } | { user: User }>;
  signOut: () => Promise<void>;
  /** True after opening a password-reset link: Settings asks for a new password only. */
  recovery: boolean;
  endRecovery: () => void;
  reload: () => Promise<void>;
  toast: (text: string) => void;
  toasts: Toast[];
  userById: (id: string) => User | undefined;
  nameOf: (id: string) => string;
  myGroups: Group[];
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [state, setState] = useState<State>(emptyState);
  const [board, setBoard] = useState<Board>({ groups: [], logs: [] });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [recovery, setRecovery] = useState(false);

  const server = useRef<Snapshot>({ state: emptyState(), ver: new Map() });
  const pending = useRef<Mutation[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const stateRef = useRef(state);
  const meRef = useRef<string | null>(null);
  /** Bumped on sign-in/out so late responses from an old session are ignored. */
  const epoch = useRef(0);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const show = useCallback((next: State) => {
    stateRef.current = next;
    setState(next);
  }, []);

  /** Rebuild the screen from the server copy plus unsaved changes. */
  const recompute = useCallback(
    (announce = false) => {
      const next = structuredClone(server.current.state);
      for (const fn of pending.current) {
        try {
          fn(next);
          tickPlans(next);
        } catch {
          /* no longer applies; it will be dropped when its save runs */
        }
      }
      const prev = stateRef.current;
      show(next);
      if (announce && meRef.current) for (const msg of describeChanges(prev, next, meRef.current)) toast(msg);
    },
    [show, toast],
  );

  const refreshBoard = useCallback(async () => {
    const e = epoch.current;
    try {
      const b = await loadBoard();
      if (e === epoch.current) setBoard(b);
    } catch (err) {
      console.warn("leaderboard refresh failed", err);
    }
  }, []);

  const loadSession = useCallback(
    async (id: string | null, email: string) => {
      if (id && id === meRef.current) {
        const me = server.current.state.users.find((u) => u.id === id);
        if (me && email && me.email !== email) {
          me.email = email;
          recompute();
        }
        return;
      }
      const e = ++epoch.current;
      meRef.current = id;
      pending.current = [];
      server.current = { state: emptyState(), ver: new Map() };
      setUserId(id);
      show(emptyState());
      setBoard({ groups: [], logs: [] });
      if (!id) return setStatus("signedOut");
      setStatus("loading");
      try {
        const snap = await loadAll(id, email);
        if (e !== epoch.current) return;
        server.current = snap;
        recompute();
        setStatus("ready");
        void refreshBoard();
      } catch (err) {
        if (e !== epoch.current) return;
        setError(errorText(err));
        setStatus("error");
      }
    },
    [recompute, refreshBoard, show],
  );

  const reload = useCallback(async () => {
    const id = meRef.current;
    if (!id) return;
    const email = server.current.state.users.find((u) => u.id === id)?.email ?? "";
    meRef.current = null;
    await loadSession(id, email);
  }, [loadSession]);

  // Follow the Supabase session (sign in, sign out, token refresh, other tabs).
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") setRecovery(false);
      // Supabase warns against awaiting its own calls inside this callback.
      setTimeout(() => void loadSession(session?.user.id ?? null, session?.user.email ?? ""), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [loadSession]);

  /** Save one queued change, retrying on top of other people's edits. */
  const flush = useCallback(
    async (fn: Mutation) => {
      const e = epoch.current;
      const me = meRef.current;
      let outcome: "saved" | "gone" | "busy" = "busy";
      try {
        for (let attempt = 0; attempt < 4 && me && e === epoch.current; attempt++) {
          const draft = structuredClone(server.current.state);
          try {
            fn(draft);
          } catch {
            outcome = "gone"; // what it changed no longer exists
            break;
          }
          tickPlans(draft);
          const conflict = await pushDiff(server.current, draft, me);
          if (!conflict) {
            outcome = "saved";
            break;
          }
          await refetch(server.current, conflict);
        }
        if (e === epoch.current && outcome === "busy") toast("Someone else changed this at the same time. Check it and try again.");
        if (e === epoch.current && outcome === "gone") toast("That changed before your edit could save. Check it and try again.");
      } catch (err) {
        if (e !== epoch.current) return;
        toast(`Couldn't save: ${errorText(err)}`);
        pending.current = pending.current.filter((x) => x !== fn);
        await reload();
        return;
      }
      if (e !== epoch.current) return;
      pending.current = pending.current.filter((x) => x !== fn);
      recompute();
      void refreshBoard();
    },
    [recompute, refreshBoard, reload, toast],
  );

  const update = useCallback(
    (fn: Mutation) => {
      if (!meRef.current) return false;
      const before = stateRef.current;
      const draft = structuredClone(before);
      try {
        fn(draft);
      } catch (err) {
        console.error(err);
        return false;
      }
      const notes = tickPlans(draft);
      if (!hasChanges(before, draft)) return true;
      pending.current.push(fn);
      show(draft);
      for (const note of notes) toast(note);
      queue.current = queue.current.then(() => flush(fn));
      return true;
    },
    [flush, show, toast],
  );

  // Plans with auto-confirm lock themselves in once voting closes. Any member's
  // open app can do it; row versions make sure only one save wins.
  useEffect(() => {
    if (status !== "ready") return;
    const tick = window.setInterval(() => update(() => {}), 30_000);
    const boardTick = window.setInterval(() => void refreshBoard(), 120_000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(boardTick);
    };
  }, [status, update, refreshBoard]);

  // Live changes from other people.
  useEffect(() => {
    if (!userId || status !== "ready") return;
    const e = epoch.current;
    const snap = () => server.current;
    const live = () => e === epoch.current;

    const loadGroupInto = async (groupId: string) => {
      const fresh = await loadGroups([groupId]);
      if (!live()) return;
      const s = snap();
      s.state.groups = [...s.state.groups.filter((g) => g.id !== groupId), ...fresh.groups];
      s.state.logs = [...s.state.logs.filter((l) => l.groupId !== groupId), ...fresh.logs];
      for (const [k, v] of fresh.ver) s.ver.set(k, v);
      await addMissingProfiles(s);
      if (live()) recompute(true);
    };

    const onGroup = (p: Change) => {
      const row = p.new as Partial<GroupRow> as GroupRow;
      if (!row?.id) return;
      const s = snap();
      const key = `g:${row.id}`;
      if (row.version <= (s.ver.get(key) ?? -1)) return; // our own save, echoed back
      const old = s.state.groups.find((g) => g.id === row.id);
      if (!old) return void loadGroupInto(row.id);
      s.state.groups = s.state.groups.map((g) => (g.id === row.id ? toGroup(row, old.memberIds) : g));
      s.ver.set(key, row.version);
      recompute(true);
    };

    const onLog = (p: Change) => {
      const row = p.new as Partial<LogRow> as LogRow;
      if (!row?.id) return;
      const s = snap();
      const key = `l:${row.id}`;
      if (row.version <= (s.ver.get(key) ?? -1)) return;
      if (!s.state.groups.some((g) => g.id === row.group_id)) return;
      s.state.logs = [...s.state.logs.filter((l) => l.id !== row.id), toLog(row)];
      s.ver.set(key, row.version);
      recompute(true);
      void refreshBoard();
    };

    const onMember = async (p: Change) => {
      const row = p.new as { group_id: string; user_id: string };
      if (!row?.group_id) return;
      const s = snap();
      const g = s.state.groups.find((x) => x.id === row.group_id);
      if (!g) return void loadGroupInto(row.group_id);
      if (g.memberIds.includes(row.user_id)) return;
      g.memberIds = [...g.memberIds, row.user_id];
      await addMissingProfiles(s);
      if (!live()) return;
      recompute();
      toast(`${s.state.users.find((u) => u.id === row.user_id)?.displayName ?? "Someone"} joined ${g.name}`);
    };

    const onFriend = async (p: Change) => {
      const row = p.new as { user_id: string; friend_id: string };
      const s = snap();
      const me = s.state.users.find((u) => u.id === userId);
      if (!me || row?.user_id !== userId || me.friendIds.includes(row.friend_id)) return;
      me.friendIds = [...me.friendIds, row.friend_id];
      if (!s.state.users.some((u) => u.id === row.friend_id)) s.state.users.push(...(await loadProfiles([row.friend_id])));
      if (!live()) return;
      recompute();
      toast(`${s.state.users.find((u) => u.id === row.friend_id)?.displayName ?? "Someone"} added you as a friend`);
    };

    const channel = supabase
      .channel(`live-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, onGroup)
      .on("postgres_changes", { event: "*", schema: "public", table: "logs" }, onLog)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_members" }, (p) => void onMember(p))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "friendships" }, (p) => void onFriend(p))
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [userId, status, recompute, refreshBoard, toast]);

  const saveProfile = useCallback(
    async (patch: ProfilePatch): Promise<string | null> => {
      const id = meRef.current;
      if (!id) return "You're signed out";
      const pub: Record<string, string | null> = {};
      if (patch.displayName !== undefined) pub.display_name = patch.displayName.trim();
      if (patch.region !== undefined) pub.region = patch.region;
      if (patch.school !== undefined) pub.school = patch.school || null;
      const priv: Record<string, string | null> = {};
      if (patch.phone !== undefined) priv.phone = digits(patch.phone) || null;
      if (patch.schoolEmail !== undefined) priv.school_email = patch.schoolEmail?.trim() || null;
      if (Object.keys(priv).length) {
        const { error: err } = await supabase.from("private_profiles").update(priv).eq("id", id);
        if (err) return err.code === "23505" ? "That phone is already in use" : errorText(err);
      }
      if (Object.keys(pub).length) {
        const { error: err } = await supabase.from("profiles").update(pub).eq("id", id);
        if (err) return errorText(err);
      }
      const me = server.current.state.users.find((u) => u.id === id);
      if (me) {
        if (patch.displayName !== undefined) me.displayName = patch.displayName.trim();
        if (patch.region !== undefined) me.region = patch.region;
        if (patch.school !== undefined) me.school = patch.school || undefined;
        if (patch.schoolEmail !== undefined) me.schoolEmail = patch.schoolEmail?.trim() || undefined;
        if (patch.phone !== undefined) me.phone = digits(patch.phone);
      }
      recompute();
      return null;
    },
    [recompute],
  );

  const addFriend = useCallback(
    async (username: string): Promise<{ error: string } | { user: User }> => {
      const name = username.trim().replace(/^@/, "").toLowerCase();
      const { data, error: err } = await supabase.rpc("add_friend", { p_username: name });
      if (err) {
        const msg: Record<string, string> = {
          no_user: `No one with the username @${name}`,
          self: "That's you!",
          already_friends: "You're already friends",
        };
        return { error: msg[err.message] ?? errorText(err) };
      }
      const friend = toUser(data);
      const s = server.current.state;
      const me = s.users.find((u) => u.id === meRef.current);
      if (me && !me.friendIds.includes(friend.id)) me.friendIds = [...me.friendIds, friend.id];
      if (!s.users.some((u) => u.id === friend.id)) s.users.push(friend);
      recompute();
      return { user: friend };
    },
    [recompute],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // My own groups replace their (possibly older) leaderboard copies.
  const fullBoard = useMemo<Board>(() => {
    const mine = new Set(state.groups.map((g) => g.id));
    return {
      groups: [...board.groups.filter((g) => !mine.has(g.id)), ...state.groups],
      logs: [...board.logs.filter((l) => !mine.has(l.groupId)), ...state.logs],
    };
  }, [board, state.groups, state.logs]);

  const value = useMemo<Store>(() => {
    const me = (status === "ready" && state.users.find((u) => u.id === userId)) || null;
    const userById = (id: string) => state.users.find((u) => u.id === id);
    return {
      status,
      error,
      state,
      board: fullBoard,
      me,
      update,
      saveProfile,
      addFriend,
      signOut,
      recovery,
      endRecovery: () => setRecovery(false),
      reload,
      toast,
      toasts,
      userById,
      nameOf: (id: string) => (id === me?.id ? "You" : (userById(id)?.displayName ?? "Someone")),
      myGroups: me ? state.groups.filter((g) => g.memberIds.includes(me.id)) : [],
    };
  }, [status, error, state, fullBoard, userId, update, saveProfile, addFriend, signOut, recovery, reload, toast, toasts]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}

/** Human-readable notices for changes other people made. */
export function describeChanges(prev: State, next: State, meId: string): string[] {
  const out: string[] = [];
  const name = (id: string) => next.users.find((u) => u.id === id)?.displayName ?? "Someone";
  for (const g of next.groups) {
    if (!g.memberIds.includes(meId)) continue;
    const old = prev.groups.find((x) => x.id === g.id);
    if (!old) {
      out.push(`You were added to ${g.name}`);
      continue;
    }
    const seen = new Set(old.feed.map((f) => f.id));
    for (const f of g.feed) {
      if (seen.has(f.id) || f.byId === meId) continue;
      out.push(`${name(f.byId)} ${feedText(f)}`);
    }
  }
  const newLogs: ActivityLog[] = next.logs.filter(
    (l) => !prev.logs.some((x) => x.id === l.id) && l.authorId !== meId,
  );
  for (const l of newLogs)
    if (next.groups.find((g) => g.id === l.groupId)?.memberIds.includes(meId))
      out.push(`${name(l.authorId)} logged “${l.title}” (+${l.points.total})`);
  return out;
}
