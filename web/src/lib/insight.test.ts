import { describe, expect, it } from "vitest";
import { guessPeople, guessTag, totalRange } from "./insight";

describe("guessTag", () => {
  it("picks the obvious tag", () => {
    expect(guessTag("dinner at dominos for five of us")).toBe("dinner");
    expect(guessTag("Coffee at Tatte")).toBe("coffee");
    expect(guessTag("Sunday brunch")).toBe("brunch");
    expect(guessTag("Catch up with Sam")).toBe("friends-date");
    expect(guessTag("Board game night")).toBe("game-night");
  });
  it("falls back to outing", () => expect(guessTag("Something fun")).toBe("outing"));
  it("is empty for empty text", () => expect(guessTag("  ")).toBeNull());
});

describe("guessPeople", () => {
  it("reads headcounts", () => {
    expect(guessPeople("dinner at dominos for five of us")).toBe(5);
    expect(guessPeople("pizza for 6")).toBe(6);
    expect(guessPeople("4 people bowling")).toBe(4);
  });
  it("returns null without a number", () => expect(guessPeople("dinner at dominos")).toBeNull());
});

it("totalRange multiplies per-person cost", () => expect(totalRange({ lo: 10, hi: 18 }, 5)).toEqual({ lo: 50, hi: 90 }));
