// Original, fictional catalog. No real-world item names, artwork or branding.
export type WeaponType = "rifle" | "smg" | "pistol" | "sniper" | "shotgun" | "knife" | "gloves";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type Pattern = "stripes" | "hex" | "circuit" | "camo" | "fade" | "carbon" | "waves" | "shards";

export const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
export const WEAPON_TYPES: WeaponType[] = ["rifle", "smg", "pistol", "sniper", "shotgun", "knife", "gloves"];

/** Fictional weapon model names per category. */
export const WEAPON_NAMES: Record<WeaponType, string> = {
  rifle: "Vektor R7",
  smg: "Hornet S9",
  pistol: "Kestrel P2",
  sniper: "Longreach X",
  shotgun: "Bastion 12",
  knife: "Talon Knife",
  gloves: "Grip Wraps",
};

/** Base drop weight per rarity tier, split evenly across a case's skins of that tier. */
export const RARITY_BASE_WEIGHT: Record<Rarity, number> = {
  common: 5500,
  uncommon: 2600,
  rare: 1300,
  epic: 450,
  legendary: 150,
};

export interface CatalogSkin {
  name: string;
  weapon: WeaponType;
  rarity: Rarity;
  value: number;
  colors: [string, string, string];
  pattern: Pattern;
  description: string;
}

export interface CatalogCollection {
  collection: string;
  caseSlug: string;
  caseName: string;
  caseDescription: string;
  accent: string;
  cost: number;
  featured?: boolean;
  skins: CatalogSkin[];
}

export const CATALOG: CatalogCollection[] = [
  {
    collection: "Origin",
    caseSlug: "starter",
    caseName: "Starter Case",
    caseDescription: "Clean, understated finishes to begin your collection.",
    accent: "#9aa4b2",
    cost: 100,
    skins: [
      { name: "Sandline", weapon: "rifle", rarity: "common", value: 20, colors: ["#c8b48a", "#8d7a55", "#3d3427"], pattern: "stripes", description: "Desert-toned bands laid down with a dry brush." },
      { name: "Ash Grain", weapon: "pistol", rarity: "common", value: 15, colors: ["#8e9298", "#5b5f66", "#2b2e33"], pattern: "carbon", description: "A matte ash finish with a faint woven grain." },
      { name: "Graphite Wash", weapon: "smg", rarity: "common", value: 18, colors: ["#6f7680", "#454b54", "#1f2329"], pattern: "fade", description: "Layered graphite washed from light to deep slate." },
      { name: "Rust Belt", weapon: "shotgun", rarity: "uncommon", value: 45, colors: ["#c46b3c", "#7d3f22", "#2e1a12"], pattern: "camo", description: "Oxidised patches baked onto a workshop steel base." },
      { name: "Arctic Vector", weapon: "rifle", rarity: "uncommon", value: 60, colors: ["#e8f1f7", "#9fb7c9", "#3d5466"], pattern: "shards", description: "Sharp polar facets cut across a frosted body." },
      { name: "Copper Trace", weapon: "sniper", rarity: "rare", value: 140, colors: ["#e09a5b", "#9c5a2b", "#1d1410"], pattern: "circuit", description: "Fine copper pathways etched into a dark composite." },
      { name: "Carbon Pulse", weapon: "pistol", rarity: "rare", value: 160, colors: ["#5ee1ff", "#1d6f8c", "#0c1418"], pattern: "carbon", description: "Carbon weave with a cyan pulse running beneath." },
      { name: "Solar Edge", weapon: "knife", rarity: "legendary", value: 1200, colors: ["#ffd36b", "#ff8a3d", "#2a1405"], pattern: "fade", description: "A blade that fades from molten core to sunrise gold." },
    ],
  },
  {
    collection: "Neon Drift",
    caseSlug: "neon",
    caseName: "Neon Case",
    caseDescription: "Night-city finishes with restrained electric color.",
    accent: "#ff5fb4",
    cost: 250,
    featured: true,
    skins: [
      { name: "Night Signal", weapon: "smg", rarity: "common", value: 30, colors: ["#4a5bff", "#232a73", "#0d0f24"], pattern: "waves", description: "Low-frequency waves broadcast across a midnight base." },
      { name: "Pink Static", weapon: "pistol", rarity: "common", value: 35, colors: ["#ff7fc4", "#7b2d5c", "#1c0b16"], pattern: "carbon", description: "Soft pink interference over a dark matte frame." },
      { name: "Crimson Circuit", weapon: "rifle", rarity: "uncommon", value: 90, colors: ["#ff4b5c", "#7a1422", "#14070a"], pattern: "circuit", description: "Red logic traces routed across the entire receiver." },
      { name: "Laser Fade", weapon: "shotgun", rarity: "uncommon", value: 85, colors: ["#ff6bd6", "#5b6bff", "#120d22"], pattern: "fade", description: "Two beams of light blended into one smooth gradient." },
      { name: "Neon Tide", weapon: "sniper", rarity: "rare", value: 260, colors: ["#3cf2d0", "#1c6f8f", "#07141c"], pattern: "waves", description: "Tidal bands of teal light rolling down the barrel." },
      { name: "Phantom Grid", weapon: "rifle", rarity: "epic", value: 650, colors: ["#b07cff", "#4b2a8f", "#0d0818"], pattern: "hex", description: "A spectral hex lattice that seems to hover off the surface." },
      { name: "Volt Wraps", weapon: "gloves", rarity: "legendary", value: 2400, colors: ["#f5ff6b", "#38d9ff", "#0b1220"], pattern: "shards", description: "Insulated wraps striped with arcs of captured voltage." },
    ],
  },
  {
    collection: "Field Ops",
    caseSlug: "tactical",
    caseName: "Tactical Case",
    caseDescription: "Purpose-built finishes from long nights in the field.",
    accent: "#8fbf6a",
    cost: 400,
    skins: [
      { name: "Dust Patrol", weapon: "rifle", rarity: "common", value: 40, colors: ["#b9a37a", "#6f6047", "#2a251c"], pattern: "camo", description: "Classic patrol camouflage for open terrain." },
      { name: "Forest Drill", weapon: "smg", rarity: "common", value: 38, colors: ["#5f7a4a", "#33452a", "#151c11"], pattern: "camo", description: "Woodland blotches for close-quarters drills." },
      { name: "Olive Mark", weapon: "pistol", rarity: "uncommon", value: 110, colors: ["#9aa36a", "#545a36", "#1b1d12"], pattern: "stripes", description: "Olive drab with stenciled marker stripes." },
      { name: "Ridge Line", weapon: "sniper", rarity: "rare", value: 340, colors: ["#c9d1b0", "#6c7a5a", "#1a1f16"], pattern: "waves", description: "Topographic contour lines traced from a mountain ridge." },
      { name: "Breach Point", weapon: "shotgun", rarity: "rare", value: 300, colors: ["#ffb347", "#3a3f44", "#121416"], pattern: "stripes", description: "Hazard banding on a gunmetal breaching frame." },
      { name: "Iron Halo", weapon: "rifle", rarity: "epic", value: 820, colors: ["#d7dde3", "#6b7682", "#14181c"], pattern: "hex", description: "Machined steel plates arranged around a bright halo." },
      { name: "Field Fang", weapon: "knife", rarity: "legendary", value: 2800, colors: ["#a4e86b", "#3a5a2a", "#0c120a"], pattern: "shards", description: "A predator's fang finish, honed for the long hunt." },
    ],
  },
  {
    collection: "Apex",
    caseSlug: "elite",
    caseName: "Elite Case",
    caseDescription: "Premium metals and rare finishes for serious collectors.",
    accent: "#e6c36a",
    cost: 750,
    skins: [
      { name: "Gilded Frame", weapon: "pistol", rarity: "uncommon", value: 180, colors: ["#f2d27a", "#8f6f2a", "#1c150a"], pattern: "carbon", description: "Brushed gold trim over a deep onyx frame." },
      { name: "Royal Mesh", weapon: "smg", rarity: "uncommon", value: 170, colors: ["#6f8cff", "#2a356f", "#0b0e1f"], pattern: "hex", description: "Royal-blue mesh woven from fine metallic thread." },
      { name: "Apex Crown", weapon: "rifle", rarity: "rare", value: 520, colors: ["#ffe08a", "#b07a2a", "#140d05"], pattern: "shards", description: "Crown-cut facets catching light from every angle." },
      { name: "White Falcon", weapon: "sniper", rarity: "epic", value: 1400, colors: ["#ffffff", "#b8c4d0", "#2a3440"], pattern: "waves", description: "Feather-light white lacquer with silver wind lines." },
      { name: "Obsidian Rule", weapon: "shotgun", rarity: "epic", value: 1250, colors: ["#8a7cff", "#2b2440", "#08070c"], pattern: "shards", description: "Volcanic glass shards fused with violet seams." },
      { name: "Sovereign Grip", weapon: "gloves", rarity: "legendary", value: 4200, colors: ["#ffd66b", "#6b3cff", "#0d0a18"], pattern: "stripes", description: "Regal violet leather bound with gold stitching." },
      { name: "Monarch Blade", weapon: "knife", rarity: "legendary", value: 5000, colors: ["#ffe9a8", "#c79a3a", "#120c03"], pattern: "fade", description: "The collector's crown jewel: a blade of liquid gold." },
    ],
  },
  {
    collection: "Nightfall",
    caseSlug: "shadow",
    caseName: "Shadow Case",
    caseDescription: "Muted, low-light finishes made to disappear.",
    accent: "#7d8bb3",
    cost: 550,
    skins: [
      { name: "Dusk Thread", weapon: "pistol", rarity: "common", value: 55, colors: ["#5c6684", "#2c3246", "#0f1118"], pattern: "stripes", description: "Thin dusk-blue threads stitched into black." },
      { name: "Void Runner", weapon: "smg", rarity: "uncommon", value: 150, colors: ["#6b5cff", "#1d1a3f", "#06050d"], pattern: "waves", description: "Built for those who move between the lights." },
      { name: "Eclipse Shard", weapon: "rifle", rarity: "rare", value: 430, colors: ["#ff9b5c", "#3a1f33", "#0a0609"], pattern: "shards", description: "The last sliver of light before a total eclipse." },
      { name: "Midnight Optic", weapon: "sniper", rarity: "rare", value: 460, colors: ["#5cc8ff", "#1a2a44", "#05080e"], pattern: "circuit", description: "Night-vision circuitry glowing faintly under matte black." },
      { name: "Grave Static", weapon: "shotgun", rarity: "epic", value: 980, colors: ["#b8ffcf", "#2a4a3a", "#060c09"], pattern: "carbon", description: "Pale green static that crawls across the surface." },
      { name: "Shade Talon", weapon: "knife", rarity: "legendary", value: 3600, colors: ["#c3b8ff", "#3b2f6b", "#07050f"], pattern: "hex", description: "A talon forged in shadow, edged with violet light." },
    ],
  },
  {
    collection: "Prism",
    caseSlug: "spectrum",
    caseName: "Spectrum Case",
    caseDescription: "Light, refraction and color — split into finishes.",
    accent: "#5ce1e6",
    cost: 350,
    skins: [
      { name: "Chroma Shift", weapon: "smg", rarity: "common", value: 35, colors: ["#5ce1e6", "#5b6bff", "#0d1424"], pattern: "fade", description: "A gentle shift between cool spectrum tones." },
      { name: "Glass Spectrum", weapon: "pistol", rarity: "common", value: 40, colors: ["#d9f6ff", "#7fa6c4", "#16202b"], pattern: "shards", description: "Frosted glass panes catching a hint of color." },
      { name: "Aurora Band", weapon: "shotgun", rarity: "uncommon", value: 95, colors: ["#7dffb0", "#5b6bff", "#081016"], pattern: "waves", description: "Northern-light bands flowing over a night base." },
      { name: "Refraction", weapon: "rifle", rarity: "rare", value: 290, colors: ["#ff8ad8", "#5ce1e6", "#0d0d1c"], pattern: "shards", description: "Light bent and split into crisp prismatic planes." },
      { name: "Prism Lance", weapon: "sniper", rarity: "epic", value: 900, colors: ["#ffffff", "#9b7cff", "#0c0a18"], pattern: "fade", description: "A single white beam fanning into the full spectrum." },
      { name: "Spectral Weave", weapon: "gloves", rarity: "legendary", value: 2600, colors: ["#ff6bd6", "#5ce1e6", "#0b0b16"], pattern: "hex", description: "Gloves woven from strands of refracted light." },
    ],
  },
];

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const DEFAULT_MISSIONS = [
  { code: "daily-open-1", title: "Open 1 case", description: "Open any case using your free virtual coins.", type: "open_case", target: 1, reward: 100, period: "daily", sort_order: 1 },
  { code: "daily-view-3", title: "Inspect 3 skins", description: "Open the detail view of 3 skins in your inventory.", type: "view_skins", target: 3, reward: 50, period: "daily", sort_order: 2 },
  { code: "daily-claim", title: "Claim daily reward", description: "Collect your free daily coins.", type: "claim_daily", target: 1, reward: 50, period: "daily", sort_order: 3 },
  { code: "profile-complete", title: "Complete your profile", description: "Mark a skin as your favorite.", type: "complete_profile", target: 1, reward: 150, period: "once", sort_order: 4 },
  { code: "weekly-streak-3", title: "3-day streak", description: "Open the app 3 days in a row.", type: "login_streak", target: 3, reward: 300, period: "weekly", sort_order: 5 },
  { code: "weekly-open-10", title: "Open 10 cases", description: "Open 10 cases during this week.", type: "open_case", target: 10, reward: 500, period: "weekly", sort_order: 6 },
] as const;

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  app_name: "SkinFlow",
  maintenance_mode: false,
  animation_intensity: "normal",
  daily_reward_amount: 250,
  cases_enabled: true,
  min_app_version: "1.0.0",
  starting_coins: 1000,
  open_cooldown_seconds: 2,
};
