import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ActivityLog, Group, Plan, State, User } from "./lib/types";
import { seed, STATE_VERSION } from "./data/seed";

/*
 * Demo "backend": the whole app state lives in localStorage, and every browser
 * window on this computer sees changes instantly via the `storage` event. That
 * powers the 4-screen demo. Each window keeps its own signed-in user in
 * sessionStorage. Replace with a real backend (e.g. Supabase realtime) to sync
 * across devices.
 */
const KEY = "makeitout-state-v2";
const SESSION_KEY = "makeitout-session";

function load(): State {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as State | null;
    if (s && s.version === STATE_VERSION && Array.isArray(s.groups)) return s;
  } catch {
    /* fall through to seed */
  }
  const fresh = seed();
  persist(fresh);
  return fresh;
}

function persist(s: State): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false; // quota exceeded (large photos/videos)
  }
}

export const uid = () => Math.random().toString(36).slice(2, 10);

interface Toast {
  id: number;
  text: string;
}

interface Store {
  state: State;
  me: User | null;
  /** Mutate a copy of state; returns false if it could not be saved. */
  update: (fn: (draft: State) => void) => boolean;
  signIn: (userId: string) => void;
  signOut: () => void;
  reset: () => void;
  toast: (text: string) => void;
  toasts: Toast[];
  userById: (id: string) => User | undefined;
  nameOf: (id: string) => string;
  myGroups: Group[];
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(load);
  const [sessionId, setSessionId] = useState<string | null>(() => sessionStorage.getItem(SESSION_KEY));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  // Live sync from other windows, with a heads-up for anything new in my groups.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY || !e.newValue) return;
      const next = JSON.parse(e.newValue) as State;
      const prev = stateRef.current;
      const meId = sessionStorage.getItem(SESSION_KEY);
      if (meId) for (const msg of describeChanges(prev, next, meId)) toast(msg);
      setState(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [toast]);

  const update = useCallback((fn: (draft: State) => void) => {
    const draft = structuredClone(stateRef.current);
    fn(draft);
    if (!persist(draft)) return false;
    stateRef.current = draft;
    setState(draft);
    return true;
  }, []);

  const value = useMemo<Store>(() => {
    const me = state.users.find((u) => u.id === sessionId) ?? null;
    const userById = (id: string) => state.users.find((u) => u.id === id);
    return {
      state,
      me,
      update,
      toast,
      toasts,
      userById,
      nameOf: (id: string) => (id === me?.id ? "You" : (userById(id)?.displayName ?? "Someone")),
      myGroups: me ? state.groups.filter((g) => g.memberIds.includes(me.id)) : [],
      signIn: (userId: string) => {
        sessionStorage.setItem(SESSION_KEY, userId);
        setSessionId(userId);
      },
      signOut: () => {
        sessionStorage.removeItem(SESSION_KEY);
        setSessionId(null);
      },
      reset: () => {
        const fresh = seed();
        persist(fresh);
        setState(fresh);
      },
    };
  }, [state, sessionId, update, toast, toasts]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}

/** Human-readable notices for changes made in another window. */
export function describeChanges(prev: State, next: State, meId: string): string[] {
  const out: string[] = [];
  const name = (id: string) => next.users.find((u) => u.id === id)?.displayName ?? "Someone";
  for (const g of next.groups) {
    if (!g.memberIds.includes(meId)) continue;
    const old = prev.groups.find((x) => x.id === g.id);
    const p = g.plan;
    const op: Plan | null | undefined = old?.plan;
    if (!old) {
      out.push(`You were added to ${g.name}`);
      continue;
    }
    if (p && p.id !== op?.id && p.byId !== meId) out.push(`${name(p.byId)} posted “${p.title}” in ${g.name}`);
    if (p && op && p.id === op.id) {
      for (const id of p.inIds) if (!op.inIds.includes(id) && id !== meId) out.push(`${name(id)} is in for ${p.title}`);
      for (const id of p.outIds) if (!op.outIds.includes(id) && id !== meId) out.push(`${name(id)} can't make ${p.title}`);
      for (const s of p.suggestions)
        if (!op.suggestions.some((x) => x.id === s.id) && s.byId !== meId) out.push(`${name(s.byId)} suggested a new time`);
      if (p.confirmedAt && !op.confirmedAt) out.push(`${p.title} is locked in`);
      if (p.date !== op.date || p.time !== op.time) out.push(`${p.title} moved to a new time`);
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
