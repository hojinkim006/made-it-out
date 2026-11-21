import { useEffect, useState } from "react";
import { estCost } from "./budget";
import { guessPeople, guessTag, type PlanInsight } from "./insight";

export interface InsightState extends PlanInsight {
  /** "gemini" when the live model answered, "local" for the keyword fallback. */
  source: "gemini" | "local";
  loading: boolean;
  /** False when the fallback has no price for this text. */
  priced: boolean;
}

const cache = new Map<string, PlanInsight>();
/** Set once the server says Gemini isn't configured, so we stop asking. */
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
      fetch("/api/plan-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, where, groupSize }),
        signal: ctl.signal,
      })
        .then((r) => {
          if (r.status === 503) offline = true;
          return r;
        })
        .then((r) => (r.ok ? (r.json() as Promise<PlanInsight>) : Promise.reject(new Error(String(r.status)))))
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
