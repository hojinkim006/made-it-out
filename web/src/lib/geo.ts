import type { ActivityLog } from "./types";
import type { PlaceData } from "./places";

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Pin extends LatLon {
  log: ActivityLog;
  /** How sure we are: an exact place, or only its neighborhood. */
  exact: boolean;
  /** True when the viewer went. */
  mine: boolean;
}

/** Spots the place data doesn't cover, by neighborhood or landmark name. */
const EXTRA: Record<string, LatLon> = {
  milton: { lat: 42.2112, lon: -71.1142 },
  "boston common": { lat: 42.355, lon: -71.0656 },
  "public garden": { lat: 42.354, lon: -71.0703 },
  "castle island": { lat: 42.3378, lon: -71.0123 },
};

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export interface Locator {
  locate(log: ActivityLog): (LatLon & { exact: boolean }) | null;
}

/** Builds lookups once per data load; locate() is then cheap per log. */
export function makeLocator(data: PlaceData): Locator {
  const byId = new Map(data.places.map((p) => [p.id, p]));
  const byName = new Map<string, LatLon>();
  for (const p of data.places) if (!byName.has(fold(p.name))) byName.set(fold(p.name), p);
  const sums = new Map<string, { lat: number; lon: number; n: number }>();
  for (const p of data.places) {
    const k = fold(p.hood);
    const s = sums.get(k) ?? { lat: 0, lon: 0, n: 0 };
    s.lat += p.lat;
    s.lon += p.lon;
    s.n++;
    sums.set(k, s);
  }
  const areas = new Map<string, LatLon>(Object.entries(EXTRA));
  for (const [k, s] of sums) areas.set(k, { lat: s.lat / s.n, lon: s.lon / s.n });
  // Longest names first, so "south boston" wins over "boston".
  const areaKeys = [...areas.keys()].sort((a, b) => b.length - a.length);
  const eventHood = new Map(data.events.map((e) => [`event/${e.id}`, fold(e.hood)]));

  const area = (text: string) => {
    const t = ` ${fold(text)} `;
    const k = areaKeys.find((a) => t.includes(` ${a} `));
    return k ? areas.get(k)! : null;
  };

  return {
    locate(log) {
      const p = log.placeId ? byId.get(log.placeId) : undefined;
      if (p) return { lat: p.lat, lon: p.lon, exact: true };
      const hood = log.placeId && eventHood.get(log.placeId);
      if (hood && areas.has(hood)) return { ...areas.get(hood)!, exact: false };
      const name = fold(log.where.split("·")[0] ?? "");
      const named = name && byName.get(name);
      if (named) return { lat: named.lat, lon: named.lon, exact: true };
      const a = area(log.where);
      return a ? { ...a, exact: false } : null;
    },
  };
}

/**
 * Pins for every log that can be placed. Pins sharing a spot are fanned out
 * a little so each one stays clickable.
 */
export function pinsFor(logs: ActivityLog[], loc: Locator, meId: string | undefined): { pins: Pin[]; unplaced: ActivityLog[] } {
  const pins: Pin[] = [];
  const unplaced: ActivityLog[] = [];
  const seen = new Map<string, number>();
  for (const log of logs) {
    const at = loc.locate(log);
    if (!at) {
      unplaced.push(log);
      continue;
    }
    const key = `${at.lat.toFixed(4)},${at.lon.toFixed(4)}`;
    const k = seen.get(key) ?? 0;
    seen.set(key, k + 1);
    const ang = k * 2.4;
    const r = k ? 0.0012 * Math.sqrt(k) : 0;
    pins.push({ lat: at.lat + Math.sin(ang) * r, lon: at.lon + Math.cos(ang) * r, exact: at.exact, log, mine: !!meId && log.attendeeIds.includes(meId) });
  }
  return { pins, unplaced };
}
