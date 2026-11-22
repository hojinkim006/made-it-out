import { createContext, useContext } from "react";

export type View = "profile" | "group" | "plan" | "log" | "leaderboard";
export type GroupTab = "overview" | "votes";

export interface Route {
  view: View;
  groupId?: string;
  tab?: GroupTab;
  /** Index of a newly grown branch to animate. */
  grow?: number | null;
  /** Prefill for the plan form, e.g. from a suggested place. */
  prefill?: { title: string; where: string; placeId?: string; date?: string };
}

export interface Nav {
  route: Route;
  go: (view: View, opts?: Omit<Route, "view">) => void;
}

export const NavCtx = createContext<Nav | null>(null);

export function useNav(): Nav {
  const n = useContext(NavCtx);
  if (!n) throw new Error("useNav outside NavCtx");
  return n;
}
