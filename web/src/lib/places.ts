import { useEffect, useState } from "react";
import type { Cat } from "./types";
import { CATS, normLabel } from "./scoring";

/*
 * Place, event and nicheness data built by pipeline/ (make_it_out_pipeline.app_data)
 * from OpenStreetMap, the Yelp Open Dataset and City of Boston event licenses.
 * Served as static JSON from web/public/data/.
 */

export interface Place {
  id: string; // "node/123"
  name: string;
  kind: string; // OSM category, e.g. "bowling_alley"
  cuisine: string | null;
  cat: Cat;
  labels: string[];
  hood: string;
  address: string | null;
  lat: number;
  lon: number;
  niche: number; // 0..1
  yelpCount: number; // businesses of this kind in the Yelp dataset
  localCount: number; // places of this kind in Boston (OSM)
}

export interface CityEvent {
  id: string;
  name: string;
  type: string; // e.g. "block-party"
  cat: Cat;
  date: string;
  end: string;
  where: string;
  hood: string;
  niche: number;
}

export interface PlaceData {
  places: Place[];
  events: CityEvent[];
  labels: Record<string, number>;
  generated: string;
}

/** Something the user can pick when logging or planning: a place or a Boston event. */
export interface Spot {
  id: string; // "node/123" or "event/PUB123"
  name: string;
  hood: string;
  cat: Cat;
  labels: string[];
  niche: number;
  kindLabel: string;
  emoji: string;
  date?: string; // events only
  detail: string; // where the score comes from
}

let cache: Promise<PlaceData> | null = null;

export function loadPlaceData(): Promise<PlaceData> {
  if (!cache) {
    const base = `${import.meta.env.BASE_URL}data/`;
    const get = (f: string) => fetch(base + f).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${f}: ${r.status}`))));
    cache = Promise.all([get("places.json"), get("events.json"), get("nicheness.json")])
      .then(([p, e, n]) => ({ places: p.places, events: e.events, labels: n.labels, generated: p.generated }))
      .catch((err) => {
        cache = null;
        throw err;
      });
  }
  return cache;
}

/** Loads once per page; null until ready (or if the data files are missing). */
export function usePlaceData(): PlaceData | null {
  const [data, setData] = useState<PlaceData | null>(null);
  useEffect(() => {
    let live = true;
    loadPlaceData()
      .then((d) => live && setData(d))
      .catch(() => console.warn("Place data not found. Run the pipeline (see docs/DATA.md)."));
    return () => {
      live = false;
    };
  }, []);
  return data;
}

const KIND_EMOJI: Record<string, string> = {
  restaurant: "🍽️",
  fast_food: "🍔",
  food_court: "🍱",
  ice_cream: "🍦",
  cafe: "☕",
  bar: "🍸",
  pub: "🍺",
  biergarten: "🍻",
  nightclub: "🪩",
  music_venue: "🎸",
  karaoke_box: "🎤",
  music: "💿",
  dance: "💃",
  park: "🌳",
  garden: "🌷",
  viewpoint: "🌄",
  zoo: "🦒",
  aquarium: "🐠",
  museum: "🏛️",
  gallery: "🖼️",
  arts_centre: "🎭",
  theatre: "🎭",
  cinema: "🎬",
  attraction: "📸",
  planetarium: "🔭",
  books: "📚",
  comics: "🦸",
  community_centre: "🏘️",
  bowling_alley: "🎳",
  escape_game: "🔐",
  amusement_arcade: "🕹️",
  miniature_golf: "⛳",
  games: "🎲",
  billiards: "🎱",
  theme_park: "🎢",
  hackerspace: "🛠️",
  climbing: "🧗",
  ice_rink: "⛸️",
  sports_centre: "🏟️",
  skateboard: "🛹",
  golf: "🏌️",
  axe_throwing: "🪓",
  trampoline_park: "🤸",
};
const CUISINE_EMOJI: Record<string, string> = {
  pizza: "🍕",
  ramen: "🍜",
  sushi: "🍣",
  coffee_shop: "☕",
  bubble_tea: "🧋",
  donut: "🍩",
  burger: "🍔",
  mexican: "🌮",
  tacos: "🌮",
  chinese: "🥡",
  dumpling: "🥟",
  korean: "🍲",
  thai: "🍛",
  indian: "🍛",
  bakery: "🥐",
  ice_cream: "🍦",
  seafood: "🦞",
  sandwich: "🥪",
  bagel: "🥯",
};
const EVENT_EMOJI: Record<string, string> = {
  "road-race": "🏃",
  "block-party": "🎉",
  parade: "🎺",
  "farmers-market": "🧺",
  concert: "🎶",
  "outdoor-movie": "🎬",
  "art-event": "🎨",
  "food-event": "🍢",
  festival: "🎪",
  "sports-event": "🏅",
  "holiday-event": "✨",
  rally: "🕯️",
  ceremony: "🎓",
  "community-event": "🏙️",
};

export const pretty = (s: string) => {
  const t = s.replace(/[_-]+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function placeSpot(p: Place): Spot {
  const kind = p.cuisine ? `${pretty(p.cuisine)} ${p.kind === "cafe" ? "café" : p.kind === "fast_food" ? "spot" : "restaurant"}` : pretty(p.kind);
  return {
    id: p.id,
    name: p.name,
    hood: p.hood,
    cat: p.cat,
    labels: p.labels,
    niche: p.niche,
    kindLabel: kind,
    emoji: (p.cuisine && CUISINE_EMOJI[p.cuisine]) || KIND_EMOJI[p.kind] || CATS[p.cat].emoji,
    detail: `${p.localCount} like it in Boston · ${p.yelpCount.toLocaleString("en-US")} in Yelp's dataset`,
  };
}

export function eventSpot(e: CityEvent): Spot {
  return {
    id: `event/${e.id}`,
    name: e.name,
    hood: e.hood,
    cat: e.cat,
    labels: [e.type],
    niche: e.niche,
    kindLabel: pretty(e.type),
    emoji: EVENT_EMOJI[e.type] ?? "🎟️",
    date: e.date,
    detail: "One-off Boston event (city permit data)",
  };
}

export function spotById(data: PlaceData, id: string | undefined): Spot | null {
  if (!id) return null;
  if (id.startsWith("event/")) {
    const e = data.events.find((x) => `event/${x.id}` === id);
    return e ? eventSpot(e) : null;
  }
  const p = data.places.find((x) => x.id === id);
  return p ? placeSpot(p) : null;
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ");

/** Search places and events by name, kind or neighborhood. Name matches rank first. */
export function searchSpots(data: PlaceData, query: string, today: string, limit = 8): Spot[] {
  const q = fold(query).trim();
  if (q.length < 2) return [];
  const words = q.split(/\s+/);
  const scored: { s: Spot; score: number }[] = [];
  const consider = (s: Spot) => {
    const name = fold(s.name);
    const hay = `${name} ${fold(s.kindLabel)} ${fold(s.hood)} ${s.labels.join(" ")}`;
    if (!words.every((w) => hay.includes(w))) return;
    const score = (name.startsWith(q) ? 3 : name.includes(q) ? 2 : words.every((w) => name.includes(w)) ? 1 : 0) + s.niche;
    scored.push({ s, score });
  };
  data.places.forEach((p) => consider(placeSpot(p)));
  data.events.filter((e) => e.date <= today).forEach((e) => consider(eventSpot(e)));
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.s);
}

/** Share of Boston places this nicheness beats, 0..100. */
export function nichePercentile(data: PlaceData, niche: number): number {
  if (!data.places.length) return 0;
  const below = data.places.filter((p) => p.niche < niche).length;
  return Math.round((below / data.places.length) * 100);
}

/**
 * Niche places the group hasn't done yet, one per kind for variety.
 * @param done labels and spot ids already in the group's logs
 */
export function suggestPlaces(data: PlaceData, done: Set<string>, opts: { cat?: Cat; limit?: number; offset?: number } = {}): Spot[] {
  const seenKinds = new Set<string>();
  const out: Spot[] = [];
  const ranked = [...data.places].filter((p) => !opts.cat || p.cat === opts.cat).sort((a, b) => b.niche - a.niche || a.name.localeCompare(b.name));
  for (const p of ranked) {
    const kind = p.cuisine ?? p.kind;
    if (seenKinds.has(kind) || done.has(p.id) || p.labels.some((l) => done.has(normLabel(l)))) continue;
    seenKinds.add(kind);
    out.push(placeSpot(p));
  }
  const offset = opts.offset ?? 0;
  const limit = opts.limit ?? 5;
  const start = out.length ? offset % out.length : 0;
  return [...out.slice(start), ...out.slice(0, start)].slice(0, limit);
}

/** Boston events from today on, soonest first. */
export function upcomingEvents(data: PlaceData, today: string, limit = 5, cat?: Cat): Spot[] {
  return data.events
    .filter((e) => e.end >= today && (!cat || e.cat === cat))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit)
    .map(eventSpot);
}
