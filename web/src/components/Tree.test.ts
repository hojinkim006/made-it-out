import { expect, it } from "vitest";
import { growthScale, MAX_FRUIT } from "./Tree";

it("grows with every hangout and tops out when every branch is filled", () => {
  const sizes = Array.from({ length: MAX_FRUIT + 1 }, (_, n) => growthScale(n));
  sizes.slice(1).forEach((s, i) => expect(s).toBeGreaterThan(sizes[i]));
  expect(growthScale(MAX_FRUIT)).toBe(1);
  expect(growthScale(MAX_FRUIT + 10)).toBe(1);
  expect(growthScale(0)).toBeCloseTo(0.55);
});
