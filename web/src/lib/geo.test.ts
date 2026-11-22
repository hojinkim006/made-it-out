import { describe, expect, it } from "vitest";
import { makeLocator, pinsFor } from "./geo";
import type { PlaceData } from "./places";
import type { ActivityLog } from "./types";

const data = {
  places: [
    { id: "node/1", name: "Yume Wo Katare", hood: "Cambridge", lat: 42.38, lon: -71.12 },
    { id: "node/2", name: "Other Spot", hood: "Cambridge", lat: 42.36, lon: -71.1 },
    { id: "node/3", name: "Pier", hood: "South Boston", lat: 42.33, lon: -71.04 },
  ],
  events: [{ id: "PUB1", hood: "South Boston" }],
  labels: {},
  generated: "",
} as unknown as PlaceData;

const log = (where: string, extra: Partial<ActivityLog> = {}) => ({ id: where, where, attendeeIds: ["me"], ...extra }) as ActivityLog;
const loc = makeLocator(data);

describe("locate", () => {
  it("uses the placeId first", () => expect(loc.locate(log("x", { placeId: "node/3" }))).toEqual({ lat: 42.33, lon: -71.04, exact: true }));
  it("puts a city event in its neighborhood", () => expect(loc.locate(log("x", { placeId: "event/PUB1" }))).toMatchObject({ lat: 42.33, exact: false }));
  it("matches a typed place name", () => expect(loc.locate(log("Yume Wo Katare · Cambridge"))).toMatchObject({ lat: 42.38, exact: true }));
  it("falls back to the neighborhood average", () => {
    const at = loc.locate(log("Somewhere · Cambridge"));
    expect(at?.exact).toBe(false);
    expect(at?.lat).toBeCloseTo(42.37);
  });
  it("prefers the longer neighborhood name", () => expect(loc.locate(log("A dock in South Boston"))).toMatchObject({ lat: 42.33 }));
  it("knows a few landmarks outside the data", () => expect(loc.locate(log("Boston Common"))).toMatchObject({ exact: false }));
  it("gives up on unknown places", () => expect(loc.locate(log("Andrew's place"))).toBeNull());
});

it("pinsFor splits unplaced logs, spreads shared spots, and marks mine", () => {
  const { pins, unplaced } = pinsFor([log("Allston?"), log("a · Cambridge"), log("b · Cambridge", { attendeeIds: ["x"] })], loc, "me");
  expect(unplaced.map((l) => l.where)).toEqual(["Allston?"]);
  expect(pins).toHaveLength(2);
  expect(pins[0].lat).not.toBe(pins[1].lat);
  expect(pins.map((p) => p.mine)).toEqual([true, false]);
});
