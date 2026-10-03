import { randomInt } from "node:crypto";

export interface Weighted<T> {
  item: T;
  weight: number;
}

/**
 * Cryptographically secure weighted pick. Probability of each entry is
 * exactly weight / sum(weights) — the same numbers shown to admins and users.
 */
export function weightedPick<T>(entries: Weighted<T>[], rng: (max: number) => number = randomInt): T {
  const valid = entries.filter((e) => Number.isInteger(e.weight) && e.weight > 0);
  if (valid.length === 0) throw new Error("weightedPick: no entries with positive weight");
  const total = valid.reduce((s, e) => s + e.weight, 0);
  let roll = rng(total);
  for (const e of valid) {
    if (roll < e.weight) return e.item;
    roll -= e.weight;
  }
  return valid[valid.length - 1].item;
}

export function probabilities<T>(entries: Weighted<T>[]): { item: T; weight: number; probability: number }[] {
  const total = entries.reduce((s, e) => s + Math.max(0, e.weight), 0) || 1;
  return entries.map((e) => ({ ...e, probability: e.weight / total }));
}
