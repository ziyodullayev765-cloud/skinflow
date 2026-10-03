import { describe, expect, it } from "vitest";
import { probabilities, weightedPick } from "../server/lib/random.js";

describe("weighted random", () => {
  const entries = [
    { item: "a", weight: 1 },
    { item: "b", weight: 3 },
    { item: "c", weight: 0 },
  ];

  it("maps rolls to items exactly by weight", () => {
    expect(weightedPick(entries, () => 0)).toBe("a");
    expect(weightedPick(entries, () => 1)).toBe("b");
    expect(weightedPick(entries, () => 3)).toBe("b");
  });

  it("never returns zero-weight items", () => {
    for (let i = 0; i < 2000; i++) expect(weightedPick(entries)).not.toBe("c");
  });

  it("matches configured probabilities statistically", () => {
    const n = 20000;
    let b = 0;
    for (let i = 0; i < n; i++) if (weightedPick(entries) === "b") b++;
    expect(b / n).toBeGreaterThan(0.72);
    expect(b / n).toBeLessThan(0.78);
  });

  it("exposes probabilities that sum to 1", () => {
    const p = probabilities(entries);
    expect(p.reduce((s, x) => s + x.probability, 0)).toBeCloseTo(1);
    expect(p[1].probability).toBeCloseTo(0.75);
  });

  it("throws when nothing can be picked", () => {
    expect(() => weightedPick([{ item: 1, weight: 0 }])).toThrow();
  });
});
