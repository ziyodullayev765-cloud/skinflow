import type { Rarity, WeaponType } from "./types";

export const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
export const WEAPONS: WeaponType[] = ["rifle", "smg", "pistol", "sniper", "shotgun", "knife", "gloves"];
export const RARITY_RANK: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
export const RARITY_HEX: Record<Rarity, string> = {
  common: "#9aa4b2",
  uncommon: "#5fb3ff",
  rare: "#8b7dff",
  epic: "#e05cff",
  legendary: "#ffb547",
};
