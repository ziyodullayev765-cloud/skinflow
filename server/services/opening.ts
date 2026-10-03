import { query, withTransaction } from "../db/pool.js";
import { ApiError } from "../lib/errors.js";
import { weightedPick } from "../lib/random.js";
import { levelForXp } from "../lib/time.js";
import { trackMission } from "./missions.js";
import { RARITY_RANK, SKIN_COLUMNS, serializeSkin, type SkinRow } from "./serialize.js";
import { getSettings } from "./settings.js";

export const REEL_LENGTH = 56;
export const REEL_WIN_INDEX = 48;
const XP_BY_RARITY: Record<string, number> = { common: 10, uncommon: 15, rare: 25, epic: 40, legendary: 80 };

/**
 * Opens a case for a user. Everything — balance check, random result,
 * inventory write, history and mission progress — happens server-side in
 * one transaction with the user row locked, so concurrent requests can't
 * double-spend or skip the cooldown.
 */
export async function openCase(userId: number, caseId: number) {
  return withTransaction(async (client) => {
    const settings = await getSettings(client);
    if (settings.maintenance_mode) throw new ApiError("MAINTENANCE", "SkinFlow is under maintenance.");
    if (!settings.cases_enabled) throw new ApiError("CASE_UNAVAILABLE", "Case opening is temporarily unavailable.");

    const user = (
      await query<{ id: number; virtual_coins: number; xp: number; blocked: boolean; cooldown_left: number | null }>(
        `SELECT id, virtual_coins, xp, blocked,
                CASE WHEN $2 > 0 THEN EXTRACT(EPOCH FROM (last_open_at + make_interval(secs => $2) - clock_timestamp())) END AS cooldown_left
           FROM users WHERE id = $1 FOR UPDATE`,
        [userId, settings.open_cooldown_seconds],
        client,
      )
    )[0];
    if (!user) throw new ApiError("INVALID_SESSION", "Account not found");
    if (user.blocked) throw new ApiError("BLOCKED", "This account has been suspended.");
    if (user.cooldown_left !== null && user.cooldown_left > 0) {
      throw new ApiError("COOLDOWN", "Please wait a moment before opening another case.", undefined, Math.ceil(user.cooldown_left));
    }

    const kase = (
      await query<{ id: number; name: string; cost: number }>(`SELECT id, name, cost FROM cases WHERE id = $1 AND active`, [caseId], client)
    )[0];
    if (!kase) throw new ApiError("CASE_UNAVAILABLE", "This case is not available.");

    const items = await query<SkinRow & { weight: number }>(
      `SELECT ${SKIN_COLUMNS}, ci.weight FROM case_items ci JOIN skins s ON s.id = ci.skin_id
        WHERE ci.case_id = $1 AND s.active ORDER BY s.id`,
      [kase.id],
      client,
    );
    if (items.length === 0) throw new ApiError("CASE_UNAVAILABLE", "This case has no items yet.");

    if (user.virtual_coins < kase.cost) {
      throw new ApiError("INSUFFICIENT_COINS", "Not enough virtual coins.", { required: kase.cost, balance: user.virtual_coins });
    }

    const weighted = items.map((i) => ({ item: i, weight: i.weight }));
    const result = weightedPick(weighted);

    // Decorative reel, also generated server-side; the winner sits at REEL_WIN_INDEX.
    const reel = Array.from({ length: REEL_LENGTH }, (_, idx) => (idx === REEL_WIN_INDEX ? result : weightedPick(weighted))).map((s) => ({
      id: s.id,
      name: s.name,
      weaponName: s.weapon_name,
      rarity: s.rarity,
      image: s.thumbnail_url || s.optimized_image_url || s.image_url,
    }));

    const xp = user.xp + (XP_BY_RARITY[result.rarity] ?? 10);
    const level = levelForXp(xp);
    const updated = (
      await query<{ virtual_coins: number }>(
        `UPDATE users SET virtual_coins = virtual_coins - $2, xp = $3, level = $4, last_open_at = clock_timestamp(), updated_at = now()
          WHERE id = $1 AND virtual_coins >= $2 RETURNING virtual_coins`,
        [userId, kase.cost, xp, level],
        client,
      )
    )[0];
    if (!updated) throw new ApiError("INSUFFICIENT_COINS", "Not enough virtual coins.");

    const inv = (
      await query<{ id: number; quantity: number }>(
        `INSERT INTO inventory (user_id, skin_id, quantity) VALUES ($1, $2, 1)
         ON CONFLICT (user_id, skin_id) DO UPDATE SET quantity = inventory.quantity + 1, updated_at = now()
         RETURNING id, quantity`,
        [userId, result.id],
        client,
      )
    )[0];

    const opening = (
      await query<{ id: number; created_at: Date }>(
        `INSERT INTO openings (user_id, case_id, skin_id, cost) VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
        [userId, kase.id, result.id, kase.cost],
        client,
      )
    )[0];

    await trackMission(client, userId, "open_case", 1);

    return {
      openingId: opening.id,
      createdAt: opening.created_at,
      caseId: kase.id,
      skin: serializeSkin(result),
      quantity: inv.quantity,
      isNew: inv.quantity === 1,
      reel,
      winIndex: REEL_WIN_INDEX,
      balance: updated.virtual_coins,
      xp,
      level,
      rarityRank: RARITY_RANK[result.rarity],
    };
  });
}
