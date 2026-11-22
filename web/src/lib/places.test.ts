import { describe, expect, it } from "vitest";
import { rarityPercentile, searchSpots, spotById, suggestPlaces, upcomingEvents, type PlaceData, type Place } from "./places";
import { rarityOf, scoreLog } from "./scoring";

const place = (id: string, name: string, kind: string, rarity: number, over: Partial<Place> = {}): Place => ({
  id,
  name,
  kind,
  cuisine: null,
  cat: "games",
  labels: [kind.replace(/_/g, "-")],
  hood: "Back Bay",
  address: null,
  lat: 42.35,
  lon: -71.08,
  rarity,
  yelpCount: 100,
  localCount: 3,
  ...over,
});

const data: PlaceData = {
  generated: "2026-11-21",
  labels: { "bowling-alley": 0.58, restaurant: 0.26, "axe-throwing": 0.74 },
  places: [
    place("node/1", "Kings Back Bay", "bowling_alley", 0.58),
    place("node/2", "Lucky Strike", "bowling_alley", 0.57),
    place("node/3", "Urban Axes", "axe_throwing", 0.74, { cat: "sports", hood: "Somerville" }),
    place("node/4", "Pho Pasteur", "restaurant", 0.3, { cuisine: "vietnamese", cat: "food", labels: ["restaurant", "vietnamese"] }),
    place("node/5", "Dunkin", "cafe", 0.15, { cat: "coffee", labels: ["cafe"] }),
  ],
  events: [
    { id: "PUB1", name: "Roslindale Tree Lighting", type: "holiday-event", cat: "outdoors", date: "2026-11-28", end: "2026-11-28", where: "Adams Park", hood: "Roslindale", rarity: 0.8 },
    { id: "PUB2", name: "Fall Fest", type: "festival", cat: "outdoors", date: "2026-10-01", end: "2026-10-01", where: "Common", hood: "Boston", rarity: 0.7 },
  ],
};

describe("place data", () => {
  it("searches by name, kind and neighborhood; only past/today events are loggable", () => {
    expect(searchSpots(data, "kings", "2026-11-21")[0].name).toBe("Kings Back Bay");
    expect(searchSpots(data, "axe", "2026-11-21")[0].id).toBe("node/3");
    expect(searchSpots(data, "somerville", "2026-11-21").map((s) => s.id)).toEqual(["node/3"]);
    expect(searchSpots(data, "tree lighting", "2026-11-21")).toEqual([]);
    expect(searchSpots(data, "fall fest", "2026-11-21")[0].id).toBe("event/PUB2");
    expect(searchSpots(data, "k", "2026-11-21")).toEqual([]);
  });
  it("describes spots with emoji and kind", () => {
    const s = spotById(data, "node/4")!;
    expect(s.kindLabel).toBe("Vietnamese restaurant");
    expect(spotById(data, "event/PUB1")!.emoji).toBe("✨");
    expect(spotById(data, "node/999")).toBeNull();
  });
  it("suggests rare places not done yet, one per kind", () => {
    const ids = suggestPlaces(data, new Set()).map((s) => s.id);
    expect(ids).toEqual(["node/3", "node/1", "node/4", "node/5"]);
    const notBowled = suggestPlaces(data, new Set(["bowling-alley"])).map((s) => s.id);
    expect(notBowled).not.toContain("node/1");
    expect(suggestPlaces(data, new Set(), { cat: "food" }).map((s) => s.id)).toEqual(["node/4"]);
  });
  it("lists upcoming events soonest first", () => {
    expect(upcomingEvents(data, "2026-11-21").map((e) => e.name)).toEqual(["Roslindale Tree Lighting"]);
  });
  it("ranks percentiles", () => {
    expect(rarityPercentile(data, 0.74)).toBe(80);
    expect(rarityPercentile(data, 0.1)).toBe(0);
  });
});

describe("dataset rarity in scoring", () => {
  it("a picked place replaces the self-chosen category", () => {
    expect(rarityOf("water", ["cafe"], { placeRarity: 0.15, labelRarity: data.labels })).toBe(0.15);
    expect(rarityOf("coffee", [], { placeRarity: 0.74 })).toBe(0.74);
  });
  it("pipeline label scores override built-in ones", () => {
    expect(rarityOf("food", ["axe-throwing"], { labelRarity: { "axe-throwing": 0.5 } })).toBe(0.5);
  });
  it("feeds into log points", () => {
    const p = scoreLog({ cat: "sports", labels: ["axe-throwing"], date: "2026-03-10", attendeeIds: ["a"] }, 1, [], undefined, { placeRarity: 0.74, labelRarity: data.labels });
    expect(p.rarity).toBe(74);
  });
});
