import { DEFAULT_SETTINGS } from "../db/catalog.js";
import { query, type Queryable } from "../db/pool.js";

export interface AppSettings {
  app_name: string;
  maintenance_mode: boolean;
  animation_intensity: "low" | "normal" | "high";
  daily_reward_amount: number;
  cases_enabled: boolean;
  min_app_version: string;
  starting_coins: number;
  open_cooldown_seconds: number;
}

let cache: { at: number; value: AppSettings } | null = null;
const TTL_MS = 5_000;

export async function getSettings(client?: Queryable, fresh = false): Promise<AppSettings> {
  if (!fresh && !client && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const rows = await query<{ key: string; value: unknown }>("SELECT key, value FROM settings", [], client);
  const value = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const r of rows) value[r.key] = r.value;
  const settings = value as unknown as AppSettings;
  if (!client) cache = { at: Date.now(), value: settings };
  return settings;
}

export function invalidateSettings(): void {
  cache = null;
}
