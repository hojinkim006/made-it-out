import { useEffect, useState } from "react";
import { estCost } from "./budget";
import { guessPeople, guessTag, type PlanInsight } from "./insight";
import { supabase } from "../supabase";

export interface InsightState extends PlanInsight {
  /** "gemini" when the live model answered, "local" for the keyword fallback. */
  source: "gemini" | "local";
  loading: boolean;
  /** False when the fallback has no price for this text. */
  priced: boolean;
}

const cache = new Map<string, PlanInsight>();
/** Set once the Edge Function is missing or has no Gemini key, so we stop asking. */
let offline = false;

function local(title: string, where: string, groupSize: number): (PlanInsight & { priced: boolean }) | null {
  if (!title.trim()) return null;
  const est = estCost(title, where);
  return {
    people: guessPeople(`${title} ${where}`) ?? groupSize,
    lo: est?.lo ?? 0,
    hi: est?.hi ?? 0,
    basis: "",
    tag: guessTag(title, where),
    priced: !!est,
  };
}

/**
 * Live cost + tag for what someone is typing. Shows the keyword fallback immediately,
 * then asks Gemini once typing pauses and swaps in its answer.
 */
export function usePlanInsight(title: string, where: string, groupSize: number, delayMs = 700): InsightState | null {
  const key = JSON.stringify([title.trim().toLowerCase(), where.trim().toLowerCase(), groupSize]);
  const [live, setLive] = useState<{ key: string; data: PlanInsight | null; loading: boolean }>({ key: "", data: null, loading: false });

  useEffect(() => {
    if (!title.trim() || cache.has(key) || offline) return;
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      setLive({ key, data: null, loading: true });
      // Supabase Edge Function "plan-insight" (supabase/functions/plan-insight). Sends the user's session token.
      supabase.functions
        .invoke<PlanInsight>("plan-insight", { body: { title, where, groupSize }, signal: ctl.signal })
        .then(({ data, error, response }) => {
          if (response?.status === 503 || response?.status === 404) offline = true;
          return error || !data ? Promise.reject(error ?? new Error("empty")) : data;
        })
        .then((data) => {
          cache.set(key, data);
          setLive({ key, data, loading: false });
        })
        .catch(() => {
          if (!ctl.signal.aborted) setLive({ key, data: null, loading: false });
        });
    }, delayMs);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [key, title, where, groupSize, delayMs]);

  const hit = cache.get(key) ?? (live.key === key ? live.data : null);
  if (hit) return { ...hit, source: "gemini", loading: false, priced: true };
  const fallback = local(title, where, groupSize);
  return fallback && { ...fallback, source: "local", loading: live.key === key && live.loading };
}
