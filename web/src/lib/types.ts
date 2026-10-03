export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type WeaponType = "rifle" | "smg" | "pistol" | "sniper" | "shotgun" | "knife" | "gloves";

export interface Skin {
  id: number;
  slug: string;
  name: string;
  weaponName: string;
  weaponType: WeaponType;
  rarity: Rarity;
  /** Optimized (WebP) image for large displays. */
  image: string;
  /** Small optimized thumbnail for grids and lists. */
  thumbnail: string;
  description: string;
  /** Fictional in-app value. Never real money. */
  virtualPrice: number;
  collectionId: number | null;
  collection: string;
  active: boolean;
  featured: boolean;
  createdAt: string;
}

export interface Me {
  id: number;
  telegramId: number | null;
  isGuest: boolean;
  username: string | null;
  firstName: string;
  lastName: string | null;
  avatarUrl: string | null;
  language: "en" | "ru" | "uz";
  coins: number;
  xp: number;
  level: number;
  levelXp: number;
  nextLevelXp: number;
  streakDays: number;
  totalOpenings: number;
  totalSkins: number;
  uniqueSkins: number;
  daily: { claimed: boolean; amount: number; nextAt: string };
  createdAt: string;
}

export interface CaseItem extends Skin {
  probability: number;
}

export interface GameCase {
  id: number;
  slug: string;
  name: string;
  description: string;
  image: string;
  accent: string;
  cost: number;
  featured: boolean;
  itemCount: number;
  rarities: Rarity[];
  rarityOdds: Partial<Record<Rarity, number>>;
  items: CaseItem[];
}

export interface InventoryItem {
  id: number;
  quantity: number;
  favorite: boolean;
  acquiredAt: string;
  updatedAt: string;
  skin: Skin;
}

export interface ReelEntry {
  id: number;
  name: string;
  weaponName: string;
  rarity: Rarity;
  image: string;
}

export interface OpenResult {
  openingId: number;
  createdAt: string;
  caseId: number;
  skin: Skin;
  quantity: number;
  isNew: boolean;
  reel: ReelEntry[];
  winIndex: number;
  balance: number;
  xp: number;
  level: number;
}

export interface Mission {
  id: number;
  code: string;
  title: string;
  description: string;
  type: string;
  target: number;
  reward: number;
  period: "daily" | "weekly" | "once";
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export interface Opening {
  id: number;
  createdAt: string;
  cost: number;
  caseId: number;
  caseName: string;
  skin: Skin;
}

export interface CollectionInfo {
  name: string;
  total: number;
  owned: number;
  skins: (Skin & { owned: boolean; quantity: number })[];
}

export interface Achievement {
  code: string;
  title: string;
  description: string;
  unlocked: boolean;
}

export interface Profile {
  user: Me;
  favoriteSkin: Skin | null;
  collectionCompletion: number;
  ownedCatalog: number;
  totalCatalog: number;
  collections: { collection: string; total: number; owned: number }[];
  missionsCompleted: number;
  rarityCounts: Partial<Record<Rarity, number>>;
  achievements: Achievement[];
}

export interface AppConfig {
  appName: string;
  maintenance: boolean;
  animationIntensity: "low" | "normal" | "high";
  minAppVersion: string;
  casesEnabled: boolean;
  guestLogin: boolean;
  telegramLogin: boolean;
  botUsername: string | null;
}
